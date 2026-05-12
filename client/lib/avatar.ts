/**
 * Generates a deterministic default avatar URL using DiceBear API.
 * Style: 'adventurer' (illustrated animated characters)
 *
 * @param name - The name of the user to seed the avatar generation
 * @returns The URL of the generated avatar
 */
export function getDefaultAvatar(name: string): string {
    const seed = encodeURIComponent(name || 'User');
    return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9&hair=short01,short02,short03,short04,short05,short06,short07,short08,short09,short10,short11,short12,short13,short14,short15&earringsProbability=0`;
}
