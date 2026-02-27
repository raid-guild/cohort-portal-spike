import { NotificationManager } from "@/modules/notification-manager/NotificationManager";

export default function NotificationManagerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Notification Manager</h1>
        <p className="text-sm text-muted-foreground">
          Choose which updates you receive and how often we send them.
        </p>
      </div>
      <NotificationManager />
    </div>
  );
}
