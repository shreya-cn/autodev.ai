import JiraBoard from '@/components/JiraBoard';
import PRComments from '@/components/PRComments';
import RelatedTickets from '@/components/RelatedTickets';

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="bg-dark rounded-2xl p-8 text-white">
          <h1 className="text-4xl font-bold mb-2">
            Welcome to <span className="text-primary">AutoDev.ai</span>
          </h1>
          <p className="text-lg text-gray-300">
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
  );
}
