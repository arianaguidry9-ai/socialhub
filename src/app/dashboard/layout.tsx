import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen mesh-gradient">
      <Sidebar />
      <main className="flex-1 lg:ml-72">
        <div className="mx-auto max-w-[1600px] p-6 pt-20 lg:p-10 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
