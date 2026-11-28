import 'server-only';
import { createCatalogClient } from '@/lib/supabase/public';
import { registrationDocuments } from './registration-documents';

export async function readRegistrationDocuments() {
  const { data, error } = await (await createCatalogClient()).rpc('roomlet_registration_documents');
  if (error) throw Error('Не удалось загрузить условия регистрации. Попробуйте позже.');
  return registrationDocuments(data);
}
