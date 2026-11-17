"use client";

import { getAvatarUploadTicket } from "@/actions/profile";
import { ImageUpload } from "@/components/image-upload";
import { UserAvatar } from "@/components/user-avatar";

/** The profile picture picker: a round preview (initials until there is a picture) and the shared upload control. */
export function AvatarUpload({ name, initialUrl }: { name: string; initialUrl?: string }) {
  return (
    <ImageUpload
      name="avatar"
      initialUrl={initialUrl}
      getTicket={getAvatarUploadTicket}
      preview={(url) => <UserAvatar name={name} image={url || undefined} size={80} />}
    />
  );
}
