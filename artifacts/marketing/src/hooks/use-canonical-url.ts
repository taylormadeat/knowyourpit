import { useEffect } from "react";
import { useLocation } from "wouter";
import { canonicalUrlForPath } from "@/lib/canonical";

function ensureLink(rel: string): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  return el;
}

function ensureMeta(property: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  return el;
}

export function useCanonicalUrl() {
  const [location] = useLocation();

  useEffect(() => {
    const url = canonicalUrlForPath(location || "/");
    ensureLink("canonical").href = url;
    ensureMeta("og:url").content = url;
  }, [location]);
}
