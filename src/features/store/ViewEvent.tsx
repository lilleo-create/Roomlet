"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function ViewEvent({ name, slug }: { name: "home_view" | "catalog_view" | "product_view"; slug?: string }) {
  useEffect(() => { track(name, slug ? { product: slug } : {}); }, [name, slug]);
  return null;
}
