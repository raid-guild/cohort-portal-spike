import { BountyBoard } from "@/modules/bounty-board/BountyBoard";

export default function BountyBoardModulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Bounty Board</h1>
        <p className="text-sm text-muted-foreground">
          Hosts can post bounties. Members can claim, submit, and discuss work.
        </p>
      </div>
      <BountyBoard />
    </div>
  );
}
