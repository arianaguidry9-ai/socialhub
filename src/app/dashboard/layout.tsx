import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen mesh-gradient">
      <Sidebar />
      <main className="flex-1 lg:ml-64">
        <div className="container mx-auto max-w-7xl p-6 pt-20 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
