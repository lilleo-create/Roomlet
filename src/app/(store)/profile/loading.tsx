import { PageHeading, Skeleton } from "@/components/ui";

export default function ProfileLoading() {
  return <section className="store-page store-narrow profile-subpage" aria-busy="true" aria-label="Загрузка профиля">
    <PageHeading title="Мой профиль" />
    <Skeleton className="profile-loading-line" />
    <Skeleton className="profile-loading-line" />
  </section>;
}
