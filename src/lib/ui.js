// shadcn/ui component class strings (button, input, card, badge, table…) for plain HTML.
const btnBase = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ";
export const ui = {
  btn:       btnBase + "h-9 px-4 py-2 bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline:   btnBase + "h-9 px-4 py-2 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost:     btnBase + "h-9 px-4 py-2 hover:bg-accent hover:text-accent-foreground",
  sm:        btnBase + "h-8 rounded-md px-3 text-xs border border-input bg-background shadow-sm hover:bg-accent",
  icon:      btnBase + "h-8 w-8 hover:bg-accent hover:text-accent-foreground",
  link:      "text-sm text-muted-foreground underline-offset-4 hover:underline",
  input:     "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  select:    "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50",
  label:     "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  card:      "rounded-xl border bg-card text-card-foreground shadow",
  cardHead:  "flex flex-col space-y-1.5 p-6 pb-3",
  cardTitle: "font-semibold leading-none tracking-tight",
  cardDesc:  "text-sm text-muted-foreground",
  cardBody:  "p-6 pt-0",
  badge:     "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  badgeSec:  "inline-flex items-center rounded-md border border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold",
  badgeOk:   "inline-flex items-center rounded-md border border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-2.5 py-0.5 text-xs font-semibold",
  table:     "w-full caption-bottom text-sm",
  th:        "h-10 px-2 text-left align-middle font-medium text-muted-foreground",
  td:        "p-2 align-middle",
  tr:        "border-b transition-colors hover:bg-muted/50",
  tabs:      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
  tab:       "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
  tabOn:     " bg-background text-foreground shadow",
};

export const field = (label, control) => `<div class="grid gap-1.5"><label class="${ui.label}">${label}</label>${control}</div>`;
