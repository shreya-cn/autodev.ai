import JiraBoard from '@/components/JiraBoard';
import PRComments from '@/components/PRComments';
import RelatedTickets from '@/components/RelatedTickets';

export default function Home() {
  return (
    <div className="min-h-screen bg-white px-6 md:px-10 lg:px-16 xl:px-24 py-6 md:py-8 lg:py-10">
      <div className="max-w-[1600px] mx-auto">
        <div className="space-y-6 md:space-y-8 lg:space-y-10">
          {/* Hero Section */}
          <div className="bg-dark rounded-2xl md:rounded-3xl px-6 md:px-10 lg:px-14 xl:px-16 py-8 md:py-12 lg:py-14 xl:py-16 text-white shadow-xl">
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 md:mb-4 lg:mb-5 leading-tight">
              Welcome to <span className="text-primary">AutoDev.ai</span>
            </h1>
            <p className="text-sm md:text-base lg:text-lg xl:text-xl text-gray-300 leading-relaxed max-w-4xl">
              Your intelligent development assistant for automated workflows and project management
            </p>
          </div>

          {/* Jira Board */}
          <JiraBoard />

          {/* PR Comments Section */}
          <PRComments />

          {/* Related Tickets Section */}
          <RelatedTickets />
        </div>
      </div>
    </div>
  );
}
