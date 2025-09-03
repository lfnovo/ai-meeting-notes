import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '@/components/layout/Layout';
import HomePage from '@/pages/HomePage';
import MeetingsPage from '@/pages/MeetingsPage';
import MeetingDetailPage from '@/pages/MeetingDetailPage';
import EntitiesPage from '@/pages/EntitiesPage';
import EntityDetailPage from '@/pages/EntityDetailPage';
import NewMeetingPage from '@/pages/NewMeetingPage';
import AdminPage from '@/pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/meetings" element={<MeetingsPage />} />
            <Route path="/meetings/:id" element={<MeetingDetailPage />} />
            <Route path="/meetings/new" element={<NewMeetingPage />} />
            <Route path="/entities" element={<EntitiesPage />} />
            <Route path="/entities/:id" element={<EntityDetailPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;