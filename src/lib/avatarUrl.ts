/** Build an unavatar.io URL for a source channel's profile picture */
export function getChannelAvatarUrl(
  sourceType: string | null | undefined,
  sourceChannel: string | null | undefined,
): string | null {
  if (!sourceType || !sourceChannel) return null;

  switch (sourceType) {
    case "telegram":
      return `https://unavatar.io/telegram/${sourceChannel}`;
    case "x_post":
      return `https://unavatar.io/x/${sourceChannel}`;
    default:
      return null;
  }
}
