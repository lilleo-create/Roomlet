import { Button, Input, PageHeading } from "@/components/ui";
import { requireOwner } from "@/features/studio/session";
import { StudioShell } from "@/features/studio/Shell";
import { canSendTeamInvites } from "@/features/studio/TeamInvite";
import { grantMaker, inviteMember, revokeMaker } from "./actions";
import "./team.css";

const notices: Record<string, string> = {
  invited: "Supabase принял приглашение к отправке. После подтверждения почты назначьте роль мастера.",
  registered: "Аккаунт уже зарегистрирован. Ему можно назначить роль мастера по подтверждённой почте.",
  granted: "Доступ мастера открыт.",
  revoked: "Доступ к мастерской отозван.",
  missing: "Аккаунт с таким подтверждённым адресом не найден.",
  email: "Проверьте адрес электронной почты.",
  "mail-unavailable": "Отправка приглашений не настроена.",
  "mail-error": "Отправку подтвердить не удалось. Проверьте почтовые настройки Supabase.",
  "grant-error": "Не удалось назначить мастера. Проверьте права и состояние аккаунта.",
  "revoke-error": "Не удалось отозвать доступ. Обновите список участников.",
};

type Member = { user_id: string; email: string; display_name: string; member_role: "owner" | "maker" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { supabase } = await requireOwner();
  const { data, error } = await supabase.rpc("roomlet_team_members");
  const members: Member[] = data ?? [];
  const { notice } = await searchParams;
  const feedback = notice && Object.hasOwn(notices, notice) ? notices[notice] : "";
  return <StudioShell active="team">
    <PageHeading title="Команда" />
    {feedback && <p className="rs-team-message" role="status">{feedback}</p>}
    {error ? <p role="alert">Не удалось загрузить участников. Проверьте подключение и миграцию управления командой.</p> :
      <div className="rs-team">
        <section><h2>Участники</h2><ul className="rs-team-members">
          {members.map(member => <li key={member.user_id}>
            <div><strong>{member.display_name || member.email}</strong>
              {member.display_name && <span>{member.email}</span>}
              <span>{member.member_role === "owner" ? "Владелец мастерской" : "Мастер"}</span>
            </div>
            {member.member_role === "maker" && <form action={revokeMaker}><input type="hidden" name="id" value={member.user_id} />
              <Button type="submit" variant="secondary" aria-label={`Отозвать доступ у ${member.email}`}>Отозвать доступ</Button>
            </form>}
          </li>)}
        </ul></section>
        <section><h2>Назначить мастера</h2><form className="rs-team-form" action={grantMaker}>
          <Input label="Подтверждённая почта участника" type="email" name="email" autoComplete="off" maxLength={254} required />
          <Button type="submit">Назначить мастером</Button>
        </form></section>
        <section><h2>Пригласить по почте</h2>{canSendTeamInvites() ?
          <form className="rs-team-form" action={inviteMember}>
            <Input label="Почта нового участника" type="email" name="email" autoComplete="off" maxLength={254} required />
            <Button type="submit" variant="secondary">Отправить приглашение</Button>
          </form> : <p>Отправка писем не настроена. Участнику с подтверждённой почтой можно назначить роль мастера.</p>}
        </section>
      </div>}
  </StudioShell>;
}
