export async function GET() {
  return Response.json({
    title: "Daily Brief",
    items: [
      {
        label: "Your update",
        value:
          "Your personal update, get up to date on all the current news in the community.",
      },
    ],
  });
}
