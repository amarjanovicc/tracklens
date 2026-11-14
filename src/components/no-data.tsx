import { Button, EmptyState } from "./ui";

export function NoData() {
  return (
    <EmptyState title="No listening data yet"
      action={<Button href="/app/import">Import your Spotify history</Button>}>
      Request your Extended streaming history from Spotify and drop the zip on the import page.
      Want to look around first? Try the sample data there.
    </EmptyState>
  );
}
