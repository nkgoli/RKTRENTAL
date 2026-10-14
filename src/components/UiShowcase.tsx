import { Alert, Progress, Steps } from './ui/Feedback';
import { Avatar, Badge, Chip, Chips } from './ui/Badge';
import { Button } from './ui/Button';
import { Card, CardHeader, Stat } from './ui/Card';
import { FileRow, Gallery, PhotoTile, UploadDropZone } from './ui/Files';
import { Check, Field, FormRow, Input, SearchInput, Select, Switch, Textarea } from './ui/Forms';
import { KanbanBoard, KanbanColumn, Ticket } from './ui/Kanban';
import { CellMain, Table, TableHead } from './ui/Table';
import { Tabs } from './ui/Tabs';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 12 }}>
      <h2 style={{ fontSize: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

export function UiShowcase() {
  return (
    <div className="stack" style={{ gap: 32 }}>
      <Section title="Buttons">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="light">Light</Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button href="/ui" variant="secondary">
            Link button
          </Button>
        </div>
      </Section>

      <Section title="Stat cards">
        <div className="grid-4">
          <Stat
            label="Rent collected"
            value="$62,430"
            delta="▲ 87% of $71,900 due"
            tone="up"
            progress={87}
          />
          <Stat
            label="Occupancy"
            value="91%"
            delta="41 of 45 units · 4 vacant"
            tone="up"
            progress={91}
          />
          <Stat
            label="Overdue"
            value="$5,240"
            delta="▼ 3 tenants past due"
            tone="down"
            progress={7}
          />
          <Stat label="Open repairs" value="7" delta="3 high priority" tone="down" progress={40} />
        </div>
      </Section>

      <Section title="Badges, avatars and chips">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Badge>Neutral</Badge>
          <Badge tone="success">Paid</Badge>
          <Badge tone="warning">Overdue</Badge>
          <Badge tone="danger">High</Badge>
          <Badge tone="info">Nov 30</Badge>
          <Avatar initials="AR" size="sm" />
          <Avatar initials="JM" />
          <Avatar initials="PN" size="lg" />
          <Chips>
            <Chip>3M</Chip>
            <Chip active>6M</Chip>
            <Chip>12M</Chip>
          </Chips>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs
          items={[
            { label: 'Overview', href: '/ui', active: true },
            { label: 'Units', href: '/ui#units' },
            { label: 'Documents', href: '/ui#documents' },
          ]}
        />
      </Section>

      <Section title="Table">
        <Card flush>
          <CardHeader title="Recent activity" action={<a href="/ui">All activity</a>} />
          <Table>
            <TableHead columns={['Event', 'Property / unit', 'When', 'Status']} />
            <tbody>
              <tr>
                <td>
                  <CellMain
                    initials="AR"
                    title="Alex Rivera paid rent"
                    subtitle="$1,850 · autopay"
                  />
                </td>
                <td>Maple Court · 4B</td>
                <td>Today, 9:12</td>
                <td>
                  <Badge tone="success">Paid</Badge>
                </td>
              </tr>
              <tr>
                <td>
                  <CellMain
                    initials="MO"
                    title="Late fee applied"
                    subtitle="$75 · 5 days overdue"
                  />
                </td>
                <td>Cedar Row Townhomes · Townhome 3</td>
                <td>Yesterday</td>
                <td>
                  <Badge tone="warning">Overdue</Badge>
                </td>
              </tr>
            </tbody>
          </Table>
        </Card>
      </Section>

      <Section title="Form fields">
        <Card>
          <form className="form">
            <div className="toolbar">
              <SearchInput placeholder="Search tenants" />
            </div>
            <FormRow>
              <Field label="Monthly rent" hint="Due on the 1st">
                <Input defaultValue="$1,850" />
              </Field>
              <Field label="Lease term">
                <Select defaultValue="12">
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                  <option value="24">24 months</option>
                </Select>
              </Field>
            </FormRow>
            <Field label="Notes">
              <Textarea placeholder="Anything the tenant should know" />
            </Field>
            <Check label="Send the lease for e-signature" defaultChecked />
            <div className="row">
              <Switch on label="Autopay" />
              <span>Autopay on</span>
              <Switch on={false} label="Late fee reminders" />
              <span>Reminders off</span>
            </div>
          </form>
        </Card>
      </Section>

      <Section title="Steps, progress and alerts">
        <Steps steps={['Set the terms', 'Add tenants', 'Review', 'Send']} current={1} />
        <Progress value={60} />
        <div className="stack" style={{ gap: 10 }}>
          <Alert>2 applications waiting for screening.</Alert>
          <Alert tone="warning">3 tenants are past due.</Alert>
          <Alert tone="success">Stripe payouts synced.</Alert>
        </div>
      </Section>

      <Section title="Files and photos">
        <div className="grid-2">
          <Card>
            <UploadDropZone />
            <FileRow kind="pdf" name="Lease agreement.pdf" meta="Signed · 240 KB" />
            <FileRow kind="img" name="Kitchen.jpg" meta="Uploaded Oct 8" />
            <FileRow name="Move-in checklist.docx" meta="Uploaded Sep 2" />
          </Card>
          <Gallery>
            <PhotoTile caption="Kitchen" />
            <PhotoTile caption="Living room" shade="b" />
            <PhotoTile caption="Bedroom" shade="c" />
            <PhotoTile caption="Bath" shade="d" />
          </Gallery>
        </div>
      </Section>

      <Section title="Kanban">
        <KanbanBoard>
          <KanbanColumn title="New" count={1}>
            <Ticket>
              <strong>Leaking faucet</strong>
              <Badge tone="danger">High</Badge>
            </Ticket>
          </KanbanColumn>
          <KanbanColumn title="Scheduled" count={1}>
            <Ticket>
              <strong>Replace smoke detector</strong>
              <Badge tone="warning">Medium</Badge>
            </Ticket>
          </KanbanColumn>
          <KanbanColumn title="In progress" count={0} />
          <KanbanColumn title="Done" count={1}>
            <Ticket>
              <strong>Paint hallway</strong>
              <Badge tone="success">Done</Badge>
            </Ticket>
          </KanbanColumn>
        </KanbanBoard>
      </Section>
    </div>
  );
}
