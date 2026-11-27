"use server";
import { redirect } from "next/navigation";
export async function enterShowcase() { redirect("/"); }
export async function leaveShowcase() { redirect("/studio"); }
