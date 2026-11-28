import { Button, Input, PageHeading } from "@/components/ui";
import { requireOwner } from "@/features/studio/session";
import { StudioShell } from "@/features/studio/Shell";
import { canSendTeamInvites } from "@/features/studio/TeamInvite";
import { inviteMember } from "./actions";
import { TeamAccess, RevokeAccess } from './TeamAccess';
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
            <div><strong>{member.display_name || member.email || 'Пользователь Roomlet'}</strong>
              {member.display_name && <span>{member.email}</span>}
              <span>Roomlet ID: {member.user_id}</span>
              <span>{member.member_role === "owner" ? "Владелец мастерской" : "Мастер"}</span>
            </div>
            {member.member_role === "maker" && <RevokeAccess id={member.user_id} name={member.display_name || member.email || 'Пользователь Roomlet'} />}
          </li>)}
        </ul></section>
        <section><h2>Назначить мастера</h2><TeamAccess /></section>
        <section><h2>Пригласить по почте</h2>{canSendTeamInvites() ?
          <form className="rs-team-form" action={inviteMember}>
            <Input label="Почта нового участника" type="email" name="email" autoComplete="off" maxLength={254} required />
            <Button type="submit" variant="secondary">Отправить приглашение</Button>
          </form> : <p>Отправка приглашений пока недоступна. Участник может войти через Telegram и сообщить вам свой идентификатор.</p>}
        </section>
      </div>}
  </StudioShell>;
}
