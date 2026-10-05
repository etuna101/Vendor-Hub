import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth";
import { profileSchema, uploadAvatar, useProfile, useUpdateProfile, type ProfileForm } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/profile")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth/signin" });
    if (!data.user.email_confirmed_at) throw redirect({ to: "/auth/signin" });
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { lang } = useI18n();
  const sw = lang === "sw";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, error } = useProfile();
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const form = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });
  useEffect(() => {
    if (profile) form.reset({ full_name: profile.full_name, phone: profile.phone, business_name: profile.business_name,
      stall_location: profile.stall_location ?? "", preferred_language: profile.preferred_language === "sw" ? "sw" : "en" });
  }, [profile, form]);

  const save = form.handleSubmit(async (values) => {
    try { await update.mutateAsync(values); toast.success(sw ? "Wasifu umehifadhiwa" : "Profile saved"); setEditing(false); }
    catch (error) {
      const detail = error instanceof Error ? error.message : "";
      toast.error(detail
        ? (sw ? `Wasifu haukuhifadhiwa: ${detail}` : `Could not save your profile: ${detail}`)
        : (sw ? "Wasifu haukuhifadhiwa. Jaribu tena." : "Could not save your profile. Try again."));
    }
  });
  const avatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try { await uploadAvatar(file, user.id); await queryClient.invalidateQueries({ queryKey: ["profile"] }); toast.success(sw ? "Picha imesasishwa" : "Photo updated"); }
    catch (e) { toast.error(e instanceof Error ? e.message : sw ? "Picha haikupakiwa" : "Could not upload photo"); }
    finally { setUploading(false); event.target.value = ""; }
  };

  if (isLoading) return <div className="mx-auto max-w-xl space-y-4 p-4"><Skeleton className="h-20 w-full"/><Skeleton className="h-64 w-full"/></div>;
  if (error || !profile) return <p role="alert" className="p-6 text-center text-destructive">{sw ? "Wasifu haujapakiwa. Jaribu tena." : "Could not load your profile. Refresh and try again."}</p>;
  const statusLabel: Record<string, string> = sw
    ? { pending: "Inasubiri idhini", approved: "Imeidhinishwa", rejected: "Haijaidhinishwa", suspended: "Imesimamishwa" }
    : { pending: "Waiting for approval", approved: "Approved", rejected: "Not approved", suspended: "Suspended" };
  const field = (name: keyof ProfileForm, label: string) => <div className="space-y-2" key={name}>
    <Label htmlFor={name}>{label}</Label><Input id={name} {...form.register(name)} disabled={!editing}/>
    {form.formState.errors[name] && <p className="text-sm text-destructive">{form.formState.errors[name]?.message}</p>}
  </div>;
  return <section className="mx-auto max-w-xl space-y-5">
    <h1 className="text-2xl font-extrabold">{sw ? "Wasifu wangu" : "My profile"}</h1>
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
      <Avatar className="size-16"><AvatarImage src={profile.avatar_url ?? undefined}/><AvatarFallback>{profile.full_name.slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1"><p className="font-bold">{profile.full_name}</p><p className="truncate text-sm text-muted-foreground">{profile.email}</p></div>
      <label className="cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold">{uploading ? (sw ? "Inapakia…" : "Uploading…") : (sw ? "Badili picha" : "Change photo")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={avatarChange} disabled={uploading} className="sr-only"/></label>
    </div>
    <div className="rounded-2xl border bg-card p-4"><p className="font-semibold">{sw ? "Hali ya akaunti" : "Account status"}</p><p className="mt-1 text-sm">{statusLabel[profile.approval_status] ?? profile.approval_status}</p><p className="mt-2 text-sm text-muted-foreground">{sw ? "Mwanachama tangu" : "Member since"} {new Date(profile.created_at).toLocaleDateString()}</p></div>
    <form onSubmit={save} className="space-y-4 rounded-2xl border bg-card p-4">
      {field("full_name", sw ? "Jina kamili" : "Full name")}{field("phone", sw ? "Nambari ya simu" : "Phone")}{field("business_name", sw ? "Jina la biashara" : "Business name")}
      {field("stall_location", sw ? "Mahali pa kibanda" : "Stall location")}
      <div className="space-y-2"><Label htmlFor="preferred_language">{sw ? "Lugha unayopendelea" : "Preferred language"}</Label><select id="preferred_language" {...form.register("preferred_language")} disabled={!editing} className="tap-target w-full rounded-xl border bg-background px-3"><option value="en">English</option><option value="sw">Kiswahili</option></select></div>
      <p className="text-sm text-muted-foreground">{sw ? "Barua pepe" : "Email"}: {profile.email ?? "—"}</p>
      {editing ? <div className="flex gap-2"><Button type="submit" disabled={update.isPending}>{sw ? "Hifadhi" : "Save changes"}</Button><Button type="button" variant="outline" onClick={() => { form.reset(); setEditing(false); }}>{sw ? "Ghairi" : "Cancel"}</Button></div> : <Button type="button" onClick={() => setEditing(true)}>{sw ? "Hariri wasifu" : "Edit profile"}</Button>}
    </form>
  </section>;
}
