import { useState } from "react";
import { getChannelAvatarUrl } from "@/lib/avatarUrl";
import { SourceIcon } from "@/lib/sourceUrl";

interface ChannelAvatarProps {
  sourceType: string;
  sourceChannel: string | null | undefined;
  className?: string;
}

export function ChannelAvatar({ sourceType, sourceChannel, className }: ChannelAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarUrl = getChannelAvatarUrl(sourceType, sourceChannel);

  if (!avatarUrl || imgFailed) {
    return <SourceIcon sourceType={sourceType} className={className} />;
  }

  return (
    <img
      src={avatarUrl}
      alt=""
      width={24}
      height={24}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`rounded-full bg-muted object-cover ${className ?? ""}`}
      onError={() => setImgFailed(true)}
    />
  );
}
