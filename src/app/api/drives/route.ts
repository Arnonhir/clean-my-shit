import { getDriveSpace } from "@/lib/installedSoftware";

// Cheap and near-instant (just Get-PSDrive) - used to populate the drive
// picker before the user chooses which one to actually analyze.
export async function GET() {
  const drives = await getDriveSpace();
  return Response.json({ drives });
}
