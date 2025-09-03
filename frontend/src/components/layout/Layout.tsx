import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  Users, 
  Home,
  Plus,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Feed', href: '/', icon: Home },
  { name: 'Meetings', href: '/meetings', icon: Calendar },
  { name: 'Entities', href: '/entities', icon: Users },
  { name: 'Admin', href: '/admin', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-xl font-bold text-foreground">
                  Meeting Minutes
                </Link>
              </div>
              
              {/* Navigation Links */}
              <div className="ml-6 flex space-x-8">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium',
                        isActive
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      )}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              <Button asChild className="w-fit min-w-0">
                <Link to="/meetings/new">
                  <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate sm:inline hidden">New Meeting</span>
                  <span className="truncate sm:hidden inline">New</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}