"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyAction,
  demoWorkspace,
  emptyWorkspace,
  initialRecipes,
  uid,
} from "@/domain/engine";
import {
  workspaceSchema,
  recipeSchema,
  type Action,
} from "@/domain/validation";
import type { Workspace, Recipe } from "@/domain/types";
import { configured, browserClient } from "@/lib/supabase/browser";
const STATE_KEY = "cabinet:demo:v1",
  CATALOG_KEY = "cabinet:demo:catalog:v1";
type Context = {
  state: Workspace | null;
  recipes: Recipe[];
  demo: boolean;
  isAdmin: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  message: string;
  act: (action: Action) => Promise<boolean>;
  startDemo: (empty?: boolean) => void;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
  saveRecipe: (recipe: Recipe, expected: number) => Promise<boolean>;
  setError: (s: string) => void;
  setMessage: (s: string) => void;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Missing workspace provider");
  return context;
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Workspace | null>(null),
    [recipes, setRecipes] = useState(initialRecipes),
    [demo, setDemo] = useState(false),
    [isAdmin, setIsAdmin] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    stateRef = useRef(state);
  stateRef.current = state;
  const startDemo = (empty = false) => {
    try {
      const stored = empty ? null : localStorage.getItem(STATE_KEY);
      const next = stored
        ? (workspaceSchema.parse(JSON.parse(stored)) as Workspace)
        : empty
          ? emptyWorkspace()
          : demoWorkspace();
      const catalogStored = localStorage.getItem(CATALOG_KEY);
      const catalog = catalogStored
        ? JSON.parse(catalogStored).map((r: unknown) => recipeSchema.parse(r))
        : initialRecipes;
      localStorage.setItem("cabinet:mode", "demo");
      localStorage.setItem(STATE_KEY, JSON.stringify(next));
      setState(next);
      stateRef.current = next;
      setRecipes(catalog);
      setDemo(true);
      setIsAdmin(true);
      setLoading(false);
      setError("");
    } catch {
      setLoading(false);
      setError(
        "داده آزمایشی ذخیره‌شده قابل خواندن نیست. از تنظیمات، آشپزخانه خالی ایجاد کنید.",
      );
    }
  };
  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      if (localStorage.getItem("cabinet:mode") === "demo" || !configured) {
        startDemo();
        return;
      }
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (response.status === 401) {
        setState(null);
        setDemo(false);
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = workspaceSchema.parse(data.state) as Workspace;
      setState(next);
      stateRef.current = next;
      setRecipes(data.recipes.map((r: unknown) => recipeSchema.parse(r)));
      setIsAdmin(data.isAdmin);
      setDemo(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری ممکن نشد");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
    const offline = () =>
      setError(
        "اتصال اینترنت قطع است؛ تغییرات حساب واقعی پس از اتصال قابل ثبت است.",
      );
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, []); // Initial load only; explicit reload owns subsequent fetches.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  const act = async (action: Action) => {
    if (lock.current || !stateRef.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const current = stateRef.current;
      let next: Workspace;
      if (demo) {
        next = applyAction(current, action, recipes);
        next.revision = current.revision + 1;
        localStorage.setItem(STATE_KEY, JSON.stringify(next));
      } else {
        if (!navigator.onLine)
          throw new Error("برای ذخیره تغییرات به اینترنت متصل شوید");
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            revision: current.revision,
            operationId: uid(),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        next = workspaceSchema.parse(data.state) as Workspace;
      }
      setState(next);
      stateRef.current = next;
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ممکن نشد");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const saveRecipe = async (recipe: Recipe, expected: number) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      recipeSchema.parse(recipe);
      if (demo) {
        const next = recipes.filter((r) => r.id !== recipe.id).concat(recipe);
        localStorage.setItem(CATALOG_KEY, JSON.stringify(next));
        setRecipes(next);
      } else {
        const response = await fetch("/api/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe, expected }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRecipes((previous) =>
          previous.filter((r) => r.id !== recipe.id).concat(data.recipe),
        );
      }
      setMessage("نسخه جدید غذا ذخیره شد");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ممکن نشد");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const logout = async () => {
    if (configured && !demo) await browserClient().auth.signOut();
    localStorage.removeItem("cabinet:mode");
    setState(null);
    setDemo(false);
    setIsAdmin(false);
    setError("");
  };
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        recipes,
        demo,
        isAdmin,
        loading,
        busy,
        error,
        message,
        act,
        startDemo,
        reload,
        logout,
        saveRecipe,
        setError,
        setMessage,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
