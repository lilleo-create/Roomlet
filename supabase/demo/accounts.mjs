import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const labels = {
  owner: "Владелец Roomlet",
  maker: "Мастер Roomlet",
  customer: "Покупатель Roomlet",
};

export async function previewAccounts(directory, keys) {
  const path = join(directory, "accounts.json");
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const accounts = Object.keys(labels).map(role => ({
    role, email: role === "maker" ? keys.email : role + "@roomlet.local",
    password: role === "maker" ? keys.password : randomBytes(32).toString("base64url"),
  }));
  // runtime.mjs holds the exclusive loopback API port while initializing accounts.
  await writeFile(path, JSON.stringify(accounts), { flag: "wx", mode: 0o600 });
  return accounts;
}

export async function provisionPreviewAccounts(db, auth, accounts, admin) {
  for (const { role, email, password } of accounts) {
    if (!Object.hasOwn(labels, role) || email !== role + "@roomlet.local") {
      throw new Error("Invalid local preview account definition");
    }
    const marker = "account:" + email;
    if ((await db.query("select 1 from roomlet_private.demo_seed_state where name=$1", [marker])).rows.length) continue;
    const existing = (await db.query("select id from auth.users where email=$1", [email])).rows[0];
    let id = existing?.id;
    if (!existing) {
      const { data, error } = await admin.createUser({ email, password, email_confirm:true });
      if (error || !data.user?.id) throw error || new Error("Could not create preview account");
      id = data.user.id;
    } else if (role !== "maker") {
      // Recover if sign-up succeeded before the first local role transaction committed.
      // An unrelated account with a matching email is never granted a workshop role.
      const { data, error } = await auth.signInWithPassword({ email, password });
      if (error || data.user?.id !== id) throw new Error("Email is already used by another preview account");
    }
    await db.transaction(async tx => {
      // Keep the original Phase 02.1 maker's current role, including a previous revocation.
      if (!existing || role !== "maker") {
        await tx.query("update public.profiles set role=$2 where id=$1", [id, role]);
      }
      await tx.query("update public.profiles set display_name=$2 where id=$1 and display_name=''", [id, labels[role]]);
      await tx.query("insert into roomlet_private.demo_seed_state(name) values($1)", [marker]);
    });
  }
}
