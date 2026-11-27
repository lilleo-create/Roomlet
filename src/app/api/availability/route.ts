import { createCatalogClient } from "@/lib/supabase/public";
import { addDays, dayOfWeek, HORIZON_DAYS, todayInStudio } from "@/features/booking/calendar";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = {"Cache-Control":"no-store"};
  if (process.env.ROOMLET_DEMO_MODE === "true") {
    const today = todayInStudio(new Date(),"UTC");
    const days = Array.from({length:HORIZON_DAYS},(_,i)=>{
      const day = addDays(today,i+1);
      return {day,available_minutes:dayOfWeek(day)<5 ? 480:0};
    });
    return Response.json({days},{headers});
  }
  try {
    const {data,error}=await createCatalogClient().rpc("roomlet_availability");
    if (error) throw error;
    return Response.json({days:(data??[]).map((d:{day:string;available_minutes:number})=>({day:d.day,available_minutes:d.available_minutes}))},{headers});
  } catch {
    return Response.json({error:"Расписание сейчас недоступно."},{status:503,headers});
  }
}
