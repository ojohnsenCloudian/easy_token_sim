"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Play,
  Upload,
  Settings,
  BarChart2,
  FolderOpen,
  Terminal,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  HardDrive,
  MousePointerClick,
  FileEdit,
} from "lucide-react";

const sections = [
  { id: "overview",     label: "Overview",              icon: BookOpen },
  { id: "quickstart",   label: "Quick Start",           icon: Play },
  { id: "customers",    label: "Managing Customers",    icon: FolderOpen },
  { id: "input-files",  label: "Input Files",           icon: Upload },
  { id: "config-form",  label: "Config Form Editor",    icon: FileEdit },
  { id: "config-yaml",  label: "Config YAML Reference", icon: Settings },
  { id: "running",      label: "Running a Simulation",  icon: Terminal },
  { id: "results",      label: "Understanding Results", icon: BarChart2 },
  { id: "capacity",     label: "Capacity Reference",    icon: HardDrive },
  { id: "faq",          label: "FAQ",                   icon: HelpCircle },
];

function SectionHeading({ id, icon: Icon, children }: { id: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-xl font-bold mt-10 mb-4 scroll-mt-24">
      <Icon className="w-5 h-5 text-primary shrink-0" />
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold mt-6 mb-2">{children}</h3>;
}

function Callout({ type = "info", children }: { type?: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info:    "bg-blue-50   border-blue-300   text-blue-900   dark:bg-blue-950/30  dark:border-blue-700  dark:text-blue-200",
    warning: "bg-amber-50  border-amber-300  text-amber-900  dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-200",
    success: "bg-green-50  border-green-300  text-green-900  dark:bg-green-950/30 dark:border-green-700 dark:text-green-200",
  };
  const icons = {
    info:    <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />,
    warning: <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />,
    success: <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />,
  };
  return (
    <div className={cn("border rounded-lg p-3.5 flex gap-2.5 my-4 text-sm", styles[type])}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
}

function YamlBlock({ children }: { children: string }) {
  return (
    <pre className="bg-zinc-950 text-zinc-100 font-mono text-xs p-4 rounded-lg overflow-x-auto my-3 whitespace-pre">
      {children}
    </pre>
  );
}

function PropRow({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 align-top">
        <code className="text-xs font-mono text-primary">{name}</code>
        {required && <Badge variant="destructive" className="ml-1.5 text-[10px] px-1 py-0">required</Badge>}
      </td>
      <td className="py-2 pr-4 align-top">
        <code className="text-xs font-mono text-muted-foreground">{type}</code>
      </td>
      <td className="py-2 text-sm text-muted-foreground align-top">{children}</td>
    </tr>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  function handleNavClick(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="max-w-6xl mx-auto flex gap-8">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 hidden lg:block">
        <div className="sticky top-6 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-3">Contents</p>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors",
                activeSection === id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-24">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Documentation</span>
          </div>
          <h1 className="text-3xl font-bold">Documentation</h1>
          <p className="text-muted-foreground mt-1">
            HyperStore Expansion Simulator — how to use the application.
          </p>
        </div>

        <Separator className="mb-8" />

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        <SectionHeading id="overview" icon={BookOpen}>Overview</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The <strong>HyperStore Expansion Simulator</strong> helps you plan a Cloudian HyperStore
          cluster expansion by simulating how data ownership will redistribute across all nodes —
          existing and new — before you make any changes to the live cluster.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          For each expansion plan you define, the simulator produces a per-DC, per-node breakdown
          of projected raw TB ownership, deviation from the DC average, and an overall
          good / imbalanced verdict. Every run is saved so you can revisit and compare past plans.
        </p>

        <SubHeading>What you need before you start</SubHeading>
        <ul className="text-sm text-muted-foreground space-y-1.5 ml-4 list-disc">
          <li>
            The output of <strong>hsstool ring</strong> collected from a node in the cluster
            (saved as a plain text file).
          </li>
          <li>
            The output of <strong>hsstool status</strong> from the same or any other node
            (saved as a plain text file).
          </li>
          <li>
            Your expansion plan: which data centres to add nodes to, how many, their raw capacity
            in TB, and the storage policies in use.
          </li>
        </ul>

        {/* ── QUICK START ───────────────────────────────────────────────────── */}
        <SectionHeading id="quickstart" icon={Play}>Quick Start</SectionHeading>
        <p className="text-sm text-muted-foreground">Four steps from zero to simulation results:</p>

        <div className="mt-4 space-y-3">
          {[
            {
              step: "1",
              title: "Create a customer",
              body: <>Click <strong>New Customer</strong> on the home page, enter the customer or cluster name, and confirm. The app creates a dedicated workspace for that cluster and takes you to the customer page.</>,
            },
            {
              step: "2",
              title: "Upload the ring and status files",
              body: <>On the customer page, drag-and-drop or click the <strong>Ring Output</strong> and <strong>Status Output</strong> cards to upload the two hsstool output files. Both files are automatically validated — any issues appear in an amber warning banner.</>,
            },
            {
              step: "3",
              title: "Set up the expansion configuration",
              body: <>Click <strong>Create with Form Editor</strong> on the Config card to open the guided form. Fill in the customer name, region, and one entry per DC you want to expand. Alternatively upload an existing <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">customer_info.yaml</code> — paths are fixed automatically.</>,
            },
            {
              step: "4",
              title: "Run the simulation and review results",
              body: <>Once all three cards show green checkmarks, click <strong>Run Simulation</strong>. Respond to the confirmation prompt, then view the balance charts and statistics in the <strong>Balance</strong> tab when complete.</>,
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex gap-4 border rounded-lg p-4">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── CUSTOMERS ─────────────────────────────────────────────────────── */}
        <SectionHeading id="customers" icon={FolderOpen}>Managing Customers</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Each <strong>customer</strong> represents one HyperStore cluster. You can have as many
          customers as you like — one for each cluster or expansion scenario you are planning.
        </p>

        <SubHeading>Creating a customer</SubHeading>
        <p className="text-sm text-muted-foreground">
          From the home page, click <strong>New Customer</strong>, type the name (e.g. <Code>acme</Code>),
          and click <strong>Create</strong>. The app creates a workspace for that customer, suffixed with
          today's date, and navigates you to its page.
        </p>

        <SubHeading>The customer page</SubHeading>
        <p className="text-sm text-muted-foreground">
          The customer page has three sections:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1.5 ml-4 list-disc mt-2">
          <li><strong>Input Files</strong> — three cards for uploading the ring file, status file, and config.</li>
          <li><strong>Run Simulation</strong> — activates once all three files are present.</li>
          <li><strong>Run History</strong> — a table of every past simulation run; click <strong>View Results</strong> to open any one.</li>
        </ul>

        <SubHeading>Deleting a customer</SubHeading>
        <p className="text-sm text-muted-foreground">
          Click the <strong>Delete customer</strong> button in the top-right of the customer page,
          or hover over a customer card on the home page and click the trash icon.
          A confirmation dialog appears before anything is deleted.
        </p>
        <Callout type="warning">
          Deleting a customer permanently removes all its uploaded files and every simulation run.
          This cannot be undone.
        </Callout>

        {/* ── INPUT FILES ───────────────────────────────────────────────────── */}
        <SectionHeading id="input-files" icon={Upload}>Input Files</SectionHeading>
        <p className="text-sm text-muted-foreground">
          Three files are required before a simulation can run. Each has its own card on the customer
          page. Drag a file onto the card or click it to open a file picker. Files can also be
          edited as raw text using the <strong>Edit</strong> button on each card.
        </p>

        <SubHeading>Ring Output</SubHeading>
        <p className="text-sm text-muted-foreground">
          The plain-text output of <strong>hsstool ring</strong> collected from any node in the cluster.
          This tells the simulator the current token distribution across all nodes and DCs.
          The file is validated for IP addresses and token assignments on upload — any problems
          appear in a warning banner below the card.
        </p>

        <SubHeading>Status Output</SubHeading>
        <p className="text-sm text-muted-foreground">
          The plain-text output of <strong>hsstool status</strong> from any cluster node.
          This provides the current up/down state of each node. The file is validated for IP
          addresses and standard node status codes (e.g. UN = Up Normal, DN = Down Normal).
        </p>

        <SubHeading>Config (customer_info.yaml)</SubHeading>
        <p className="text-sm text-muted-foreground">
          The expansion plan configuration file. This is the most important file — it defines
          which DCs to expand, how many nodes to add, their capacity, and the storage policies.
          You have two ways to create or edit it:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc mt-2">
          <li><strong>Form Editor</strong> — a structured guided interface (recommended). Click <strong>Create / Edit with Form Editor</strong> on the Config card.</li>
          <li><strong>Raw YAML</strong> — click <strong>Edit as Raw YAML</strong> for a full-text editor. See the <button onClick={() => handleNavClick("config-yaml")} className="text-primary underline underline-offset-2">Config YAML Reference</button> for the format.</li>
        </ul>

        <SubHeading>Uploading an existing config file</SubHeading>
        <p className="text-sm text-muted-foreground">
          If you have a config file from a previous tool version or another environment, drag it onto
          the Config card. The app automatically fixes any incorrect file paths in the config
          and removes fields that are managed internally. A blue info banner confirms what was changed.
        </p>

        {/* ── CONFIG FORM EDITOR ────────────────────────────────────────────── */}
        <SectionHeading id="config-form" icon={FileEdit}>Config Form Editor</SectionHeading>
        <p className="text-sm text-muted-foreground">
          The Form Editor is the easiest way to create and update the expansion configuration.
          It opens as a full page with two tabs: <strong>Form Editor</strong> and <strong>Raw YAML</strong>.
          You can switch between them at any time — changes in one are reflected in the other when you save.
        </p>

        <SubHeading>Customer details</SubHeading>
        <p className="text-sm text-muted-foreground">
          Set the <strong>Customer Name</strong> (must match the cluster name used in reports),
          the <strong>Region</strong> label, whether to use <strong>Cumulative Tokens</strong>
          (leave enabled for standard expansions), and optionally a preferred token count per new node.
        </p>

        <SubHeading>Data Centers</SubHeading>
        <p className="text-sm text-muted-foreground">
          Click <strong>Add DC</strong> to add an entry for each data centre you want to expand.
          For each DC fill in:
        </p>
        <div className="border rounded-lg overflow-hidden mt-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Field</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="border-b"><td className="px-3 py-2 font-medium text-xs">DC Name</td><td className="px-3 py-2 text-muted-foreground text-xs">Must exactly match the DC name as it appears in the ring file.</td></tr>
              <tr className="border-b"><td className="px-3 py-2 font-medium text-xs">Nodes to add</td><td className="px-3 py-2 text-muted-foreground text-xs">Number of new nodes being added to this DC.</td></tr>
              <tr className="border-b"><td className="px-3 py-2 font-medium text-xs">Node capacity (TB)</td><td className="px-3 py-2 text-muted-foreground text-xs">Raw usable TB per new node. See the <button onClick={() => handleNavClick("capacity")} className="text-primary underline underline-offset-2">Capacity Reference</button> to look up this value by HSA model.</td></tr>
              <tr className="border-b"><td className="px-3 py-2 font-medium text-xs">Storage Policies</td><td className="px-3 py-2 text-muted-foreground text-xs">One or more policies applied in this DC. Add RF or EC policies with the <strong>+ Add Policy</strong> button.</td></tr>
              <tr><td className="px-3 py-2 font-medium text-xs">Racks</td><td className="px-3 py-2 text-muted-foreground text-xs">Optional. If nodes are spread across multiple racks, use <strong>+ Add Rack</strong> to distribute the count per rack.</td></tr>
            </tbody>
          </table>
        </div>

        <SubHeading>Storage policies in the form</SubHeading>
        <div className="border rounded-lg overflow-hidden mt-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Policy type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">When to use</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Fields to fill</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="border-b">
                <td className="px-3 py-2 font-medium text-xs">RF (Replication Factor)</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">Standard replicated storage.</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">RF value (e.g. 3). Optionally set how many replicas are stored in this DC if using cross-DC RF.</td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-2 font-medium text-xs">EC (Erasure Coding)</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">Erasure-coded storage across nodes.</td>
                <td className="px-3 py-2 text-muted-foreground text-xs">k and m values (e.g. k=7, m=5 for EC 7+5). Optionally set fragments stored in this DC for distributed EC across DCs.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout type="info">
          For a typical 3-DC distributed EC 7+5 setup: add an EC policy in each DC with k=7, m=5
          and set <strong>fragments in this DC</strong> to 4 (12 total fragments ÷ 3 DCs = 4 per DC).
        </Callout>

        <SubHeading>New nodes (optional)</SubHeading>
        <p className="text-sm text-muted-foreground">
          In the <strong>New Nodes</strong> section, you can enter the real hostnames or IP addresses
          of the nodes being added. This is optional — if omitted, the simulator uses placeholder
          addresses in the output. If provided, enter one row per node with the hostname/IP,
          which DC it belongs to, and which rack.
        </p>

        <SubHeading>Saving</SubHeading>
        <p className="text-sm text-muted-foreground">
          Click <strong>Save</strong> to save without leaving the editor, or <strong>Save &amp; Back</strong>
          to save and return to the customer page. Both buttons appear in the sticky header at the top
          of the form page.
        </p>

        {/* ── CONFIG YAML REFERENCE ─────────────────────────────────────────── */}
        <SectionHeading id="config-yaml" icon={Settings}>Config YAML Reference</SectionHeading>
        <p className="text-sm text-muted-foreground">
          If you prefer to edit the config directly as YAML — using the <strong>Edit as Raw YAML</strong>
          option or by uploading a file — this section describes every field.
        </p>

        <SubHeading>Full example</SubHeading>
        <YamlBlock>{`customer_name: "acme"
region: "us_east"
cumulative: "True"
preferred_token_number: 307   # optional

hss_ring_output: "hsstool-ring.txt"
hss_status_output: "hsstool-status.txt"

# One entry per DC — format: "DC_NAME;num_nodes;node_capacity_TB;policy[;RACK:count,...]"
dc_for_nodes:
  - "dc1;2;452;7+5:4;rack1:2"
  - "dc2;2;452;7+5:4;rack1:2"
  - "dc3;2;452;7+5:4;rack1:2"

# Optional: real hostnames for new nodes — format: "hostname:dc:rack"
nodes_to_add:
  - "10.0.0.101:dc1:rack1"
  - "10.0.0.102:dc1:rack1"
  - "10.0.0.201:dc2:rack1"
  - "10.0.0.202:dc2:rack1"

# Optional: exclude these nodes from balance statistics (comma-separated)
exclude: "192.168.1.99,192.168.1.100"`}</YamlBlock>

        <SubHeading>Fields</SubHeading>
        <div className="border rounded-lg overflow-hidden mt-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Field</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y px-3">
              <PropRow name="customer_name" type="string" required>Cluster/customer identifier used in report file names.</PropRow>
              <PropRow name="region" type="string" required>Cloudian region label (e.g. <Code>us_east</Code>, <Code>oslo</Code>).</PropRow>
              <PropRow name="hss_ring_output" type="string" required>Always set to <Code>hsstool-ring.txt</Code>. Automatically fixed on upload.</PropRow>
              <PropRow name="hss_status_output" type="string" required>Always set to <Code>hsstool-status.txt</Code>. Automatically fixed on upload.</PropRow>
              <PropRow name="dc_for_nodes" type="string[]" required>List of DC expansion entries. See format below.</PropRow>
              <PropRow name="cumulative" type='"True" | "False"'>Cumulative token mode. Leave as <Code>True</Code> for standard expansions.</PropRow>
              <PropRow name="preferred_token_number" type="integer">Preferred vNode count per new node. If omitted the simulator calculates it automatically.</PropRow>
              <PropRow name="nodes_to_add" type="string[]">Real hostnames or IPs for new nodes, used in output reports. Optional.</PropRow>
              <PropRow name="exclude" type="string">Comma-separated IPs or hostnames of existing nodes to exclude from balance calculations. Useful for decommissioning nodes or known outliers. Optional.</PropRow>
            </tbody>
          </table>
        </div>

        <SubHeading>dc_for_nodes entry format</SubHeading>
        <p className="text-sm text-muted-foreground mb-2">
          Each entry is a semicolon-separated string:
          <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono ml-2">
            DC_NAME ; num_nodes ; node_capacity_TB ; policy [; RACK:count, ...]
          </code>
        </p>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Segment</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="border-b"><td className="px-3 py-2"><Code>DC_NAME</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">DC name — must match what is in the ring file.</td><td className="px-3 py-2"><Code>dc1</Code></td></tr>
              <tr className="border-b"><td className="px-3 py-2"><Code>num_nodes</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">Number of new nodes to add.</td><td className="px-3 py-2"><Code>2</Code></td></tr>
              <tr className="border-b"><td className="px-3 py-2"><Code>node_capacity_TB</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">Raw TB capacity of each new node. See <button onClick={() => handleNavClick("capacity")} className="text-primary underline underline-offset-2">Capacity Reference</button>.</td><td className="px-3 py-2"><Code>452</Code></td></tr>
              <tr className="border-b"><td className="px-3 py-2"><Code>policy</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">Storage policy (see table below). Multiple policies comma-separated.</td><td className="px-3 py-2"><Code>7+5:4</Code></td></tr>
              <tr><td className="px-3 py-2"><Code>RACK:count</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">Optional rack distribution. Counts must sum to num_nodes.</td><td className="px-3 py-2"><Code>rack1:1,rack2:1</Code></td></tr>
            </tbody>
          </table>
        </div>

        <SubHeading>Storage policy formats</SubHeading>
        <div className="border rounded-lg overflow-hidden mt-2">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Format</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Meaning</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr className="border-b"><td className="px-3 py-2"><Code>3</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">RF-3, all replicas stored in this DC.</td><td className="px-3 py-2"><Code>3</Code></td></tr>
              <tr className="border-b"><td className="px-3 py-2"><Code>3:2</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">RF-3, 2 replicas in this DC, remainder in other DCs.</td><td className="px-3 py-2"><Code>3:2</Code></td></tr>
              <tr className="border-b"><td className="px-3 py-2"><Code>k+m</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">EC k+m, all fragments stored in this DC.</td><td className="px-3 py-2"><Code>4+2</Code></td></tr>
              <tr><td className="px-3 py-2"><Code>k+m:f</Code></td><td className="px-3 py-2 text-muted-foreground text-xs">EC k+m distributed across DCs, <em>f</em> fragments in this DC.</td><td className="px-3 py-2"><Code>7+5:4</Code></td></tr>
            </tbody>
          </table>
        </div>

        {/* ── RUNNING ───────────────────────────────────────────────────────── */}
        <SectionHeading id="running" icon={Terminal}>Running a Simulation</SectionHeading>

        <SubHeading>Starting a run</SubHeading>
        <p className="text-sm text-muted-foreground">
          On the customer page, click the <strong>Run Simulation</strong> button. It is only
          enabled when all three input file cards show a green checkmark. A live terminal panel
          opens below the button and streams output as the simulation runs.
        </p>

        <SubHeading>Interactive prompts</SubHeading>
        <p className="text-sm text-muted-foreground">
          During the run, the simulator may pause and ask for your confirmation. When this happens,
          an amber card appears below the terminal output with action buttons. Two prompts can occur:
        </p>
        <div className="space-y-3 mt-3">
          <div className="border rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Prompt 1</Badge>
              <span className="font-medium">Confirm simulation</span>
            </div>
            <p className="text-muted-foreground text-xs">
              After printing the expansion summary the simulator waits for your go-ahead.
              Click <strong>Continue simulation</strong> to proceed or <strong>Exit</strong> to abort
              and fix the config first.
            </p>
          </div>
          <div className="border rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Prompt 2</Badge>
              <span className="font-medium">New DC detected</span>
            </div>
            <p className="text-muted-foreground text-xs">
              If a DC name in your config is not found in the ring file, the simulator asks whether
              to continue. Click <strong>Yes, continue</strong> if you are intentionally adding a
              new DC, or <strong>No, exit</strong> if the DC name is a typo — then correct it in
              the config and re-run.
            </p>
          </div>
        </div>

        <SubHeading>Run history</SubHeading>
        <p className="text-sm text-muted-foreground">
          Every simulation is saved. The <strong>Run History</strong> table on the customer page
          shows all past runs with their status and timestamp. Click <strong>View Results</strong>
          next to any completed run to open its results page.
        </p>

        {/* ── RESULTS ───────────────────────────────────────────────────────── */}
        <SectionHeading id="results" icon={BarChart2}>Understanding Results</SectionHeading>
        <p className="text-sm text-muted-foreground">
          The results page has five tabs. It opens on the <strong>Balance</strong> tab by default.
        </p>

        <SubHeading>Balance tab</SubHeading>
        <p className="text-sm text-muted-foreground">
          The primary view. One section per DC, each containing a bar chart and a detail table.
        </p>
        <ul className="text-sm text-muted-foreground space-y-1.5 ml-4 list-disc mt-2">
          <li>Each bar represents one node. <span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1 align-middle" /><strong>Blue</strong> = new node being added. <span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1 align-middle" /><strong>Grey</strong> = existing node.</li>
          <li>The orange dashed line shows the DC average. Bars close to this line = good balance.</li>
          <li>Hover any bar for a tooltip with raw TB, vNode count, and deviation %.</li>
          <li>The table below each chart colour-codes deviation: <span className="text-green-600 font-medium">green</span> (&lt;5%), <span className="text-amber-600 font-medium">amber</span> (5–10%), <span className="text-red-600 font-medium">red</span> (&gt;10%).</li>
        </ul>
        <Callout type="success">
          The <strong>&quot;Good balance&quot;</strong> badge means no node deviates from the DC average by
          more than 10% — this is the target outcome for an expansion plan.
        </Callout>

        <SubHeading>Terminal tab</SubHeading>
        <p className="text-sm text-muted-foreground">
          The full raw output captured during the simulation run. Useful for diagnosing unexpected
          results or verifying what the simulator calculated.
        </p>

        <SubHeading>Token Map tab</SubHeading>
        <p className="text-sm text-muted-foreground">
          The complete projected token-to-node assignment table — what the ring will look like after
          the expansion is applied.
        </p>

        <SubHeading>DC Map and Hostnames tabs</SubHeading>
        <p className="text-sm text-muted-foreground">
          Supporting lookup tables showing which nodes belong to which DC, and the IP-to-hostname
          mapping used in the simulation. Useful for cross-checking that the simulator interpreted
          your config correctly.
        </p>

        <SubHeading>Files tab</SubHeading>
        <p className="text-sm text-muted-foreground">
          All output files produced by the simulation (token maps, DC maps, HTML reports, etc.).
          Download individual files, or click <strong>Download All (.zip)</strong> to get everything
          in a single archive.
        </p>

        {/* ── CAPACITY REFERENCE ────────────────────────────────────────────── */}
        <SectionHeading id="capacity" icon={HardDrive}>Capacity Reference</SectionHeading>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Use this table to look up the <strong>raw usable capacity in TB</strong> for a node by
          its HSA model number and the SSD drive size installed.
          Enter this number as the node capacity when configuring a DC expansion.
        </p>
        <Callout type="info">
          Cells marked <strong>n/a</strong> mean that drive size is not supported for that model.
          Empty cells (—) indicate no data is available.
        </Callout>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60">
                <th className="border px-3 py-2 text-left font-semibold text-xs" rowSpan={2}>HSA</th>
                <th className="border px-3 py-2 text-center font-semibold text-xs" colSpan={5}>Raw Node Capacity (TB) by SSD Drive Size</th>
              </tr>
              <tr className="bg-muted/40">
                {[
                  { label: "480 GB",  sub: "0.4277 TB/drive" },
                  { label: "960 GB",  sub: "0.857 TB/drive"  },
                  { label: "1.92 TB", sub: "1.69 TB/drive"   },
                  { label: "3.84 TB", sub: "3.44 TB/drive"   },
                  { label: "7.68 TB", sub: "6.88 TB/drive"   },
                ].map(({ label, sub }) => (
                  <th key={label} className="border px-3 py-2 text-center text-xs font-semibold">
                    <div>{label}</div>
                    <div className="font-normal text-muted-foreground text-[10px]">{sub}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { group: true, label: "15xx Series" },
                { hsa: "1508", cols: ["86",        "86",   "87",  "89",  null ] },
                { hsa: "1510", cols: ["107",       "108",  "108", "110", null ] },
                { hsa: "1512", cols: ["132",       "133",  "134", "135", null ] },
                { hsa: "1514", cols: ["156",       "157",  "158", "159", null ] },
                { group: true, label: "16xx Series" },
                { hsa: "1610", cols: ["n/a",       "n/a",  "108", "110", "114"] },
                { hsa: "1612", cols: ["n/a",       "n/a",  "134", "135", "139"] },
                { hsa: "1614", cols: ["n/a",       "n/a",  "158", "159", "163"] },
                { hsa: "1616", cols: ["n/a",       "n/a",  "181", "183", "187"] },
                { hsa: "1618", cols: ["n/a",       "n/a",  "194", "195", "199"] },
                { group: true, label: "17xx Series" },
                { hsa: "1716", cols: [null,         null,  "181", "183", "187"] },
                { hsa: "1722", cols: [null,         null,  "240", "242", "246"] },
                { group: true, label: "21xx Series" },
                { hsa: "2122", cols: [null,         null,  "479", "481", "484"] },
                { group: true, label: "40xx Series" },
                { hsa: "4008", cols: ["249",       "249",  "250", "250", null ] },
                { hsa: "4010", cols: ["312",       "312",  "313", "315", null ] },
                { hsa: "4012", cols: ["385",       "386",  "387", "388", null ] },
                { hsa: "4014", cols: ["455",       "456",  "457", "458", null ] },
                { group: true, label: "41xx Series" },
                { hsa: "4110", cols: ["n/a",       "n/a",  "313", "315", "318"] },
                { hsa: "4112", cols: ["n/a",       "n/a",  "387", "388", "392"] },
                { hsa: "4114", cols: ["n/a",       "n/a",  "457", "458", "462"] },
                { group: true, label: "42xx Series" },
                { hsa: "4212", cols: ["n/a",       "n/a",  "332", "333", "337"] },
                { hsa: "4214", cols: ["n/a",       "n/a",  "392", "393", "397"] },
                { hsa: "4216", cols: ["n/a",       "n/a",  "452", "453", "457"] },
                { hsa: "4218", cols: ["n/a",       "n/a",  null,  "483", "487"] },
                { group: true, label: "43xx Series" },
                { hsa: "4316", cols: ["n/a",       "n/a",  "452", "453", "457"] },
                { hsa: "4318", cols: ["n/a",       "n/a",  null,  "483", "487"] },
                { hsa: "4320", cols: ["n/a",       "n/a",  null,  null,  null ] },
                { hsa: "4322", cols: ["n/a",       "n/a",  null,  "600", "604"] },
                { group: true, label: "44xx Series" },
                { hsa: "4418", cols: ["n/a",       "n/a",  null,  "723", null ] },
                { group: true, label: "45xx Series" },
                { hsa: "4516", cols: ["722 / 723",  null,  "727", null,  null ] },
              ].map((row, i) => {
                if ("group" in row) {
                  return (
                    <tr key={i} className="bg-zinc-900">
                      <td colSpan={6} className="px-3 py-1 text-[11px] font-semibold text-zinc-100 uppercase tracking-wide">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={i} className="even:bg-muted/20 hover:bg-primary/5 transition-colors">
                    <td className="border px-3 py-1.5 font-mono font-semibold text-xs">{row.hsa}</td>
                    {row.cols.map((val, ci) => (
                      <td key={ci} className={`border px-3 py-1.5 text-center text-xs font-mono ${
                        val === null  ? "text-muted-foreground/30" :
                        val === "n/a" ? "text-muted-foreground italic" :
                        "font-semibold"
                      }`}>
                        {val ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <SectionHeading id="faq" icon={HelpCircle}>FAQ</SectionHeading>

        {[
          {
            q: "The Run Simulation button is disabled — why?",
            a: "All three input file cards must show a green checkmark (Ring Output, Status Output, and Config). Upload any missing files to enable the button.",
          },
          {
            q: "I uploaded a config file and see a blue 'paths fixed' banner — is that a problem?",
            a: "No. The file contained absolute paths from a different environment. They were automatically rewritten to the correct values. No action is needed on your part.",
          },
          {
            q: "My file has a warning banner — can I still run the simulation?",
            a: "Yes. Validation warnings are advisory and do not block the simulation. Review the warnings to decide if they need addressing before trusting the results.",
          },
          {
            q: "What does 'Cumulative Tokens' mean in the config?",
            a: "When enabled (the default), the new node receives a token count proportional to its capacity relative to the existing cluster. This is the standard mode for capacity-balanced expansions. Disable it only if you specifically need non-cumulative token assignment.",
          },
          {
            q: "The simulation paused with 'New DC detected' — what should I do?",
            a: "If you are intentionally adding a brand-new DC to the cluster, click 'Yes, continue'. If the DC name in your config is a typo, click 'No, exit', correct the DC name in the Form Editor, and run again.",
          },
          {
            q: "How do I expand multiple DCs at once?",
            a: "Add one DC entry per data centre in the Form Editor, or add multiple entries in dc_for_nodes in the YAML. The simulator processes each DC independently and produces a separate balance chart for each.",
          },
          {
            q: "Can I run the simulation multiple times for the same customer?",
            a: "Yes. Each run is stored separately in Run History. Run the simulator multiple times with different configs to compare expansion scenarios.",
          },
          {
            q: "How do I get the output files from a run?",
            a: "Open the run from Run History, go to the Files tab, and click Download next to any file — or use 'Download All (.zip)' to get everything at once.",
          },
          {
            q: "What does the 'preferred token number' field do?",
            a: "It sets the number of vNodes assigned to each new node. If left blank, the simulator calculates the optimal count based on node capacity and the existing cluster. You can override it when you need to match a specific token count (e.g. to keep all nodes uniform).",
          },
        ].map(({ q, a }) => (
          <div key={q} className="border rounded-lg p-4 mt-3">
            <p className="text-sm font-semibold flex items-start gap-2">
              <MousePointerClick className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              {q}
            </p>
            <p className="text-sm text-muted-foreground mt-1.5 ml-6">{a}</p>
          </div>
        ))}

        <div className="mt-12 pt-6 border-t text-xs text-muted-foreground">
          HyperStore Expansion Simulator — internal planning tool.
        </div>
      </div>
    </div>
  );
}
