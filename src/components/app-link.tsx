import NextLink from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { publicAsset } from "@/lib/paths";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function AppLink({ href, ...props }: Props) {
  if (process.env.NEXT_PUBLIC_STATIC_DEMO === "true") {
    // Pages serves exported documents directly, without Next's RSC server.
    const target = href.startsWith("/")
      ? publicAsset(href.endsWith("/") ? href : `${href}/`)
      : href;
    return <a href={target} {...props} />;
  }
  return <NextLink href={href} {...props} />;
}
