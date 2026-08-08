export default async function ShelfPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return <div>{username}</div>;
}
