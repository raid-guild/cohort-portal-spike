import { FeedbackCenter } from "@/modules/feedback-center/FeedbackCenter";

export default function FeedbackCenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Feedback Center</h1>
        <p className="text-sm text-muted-foreground">
          Submit feedback, bug reports, and feature requests without leaving the portal.
        </p>
      </div>
      <FeedbackCenter />
    </div>
  );
}
