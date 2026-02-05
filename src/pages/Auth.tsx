import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, UserCircle, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useWebsiteLayoutSettings } from '@/hooks/useWebsiteLayout';
 
type AppRole = 'user' | 'assist';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupUserSchema = loginSchema
  .extend({
    firstName: z.string().trim().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
    lastName: z.string().trim().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const signupAssistSchema = loginSchema
  .extend({
    // Use firstName field to store Full Name for assist
    firstName: z.string().trim().min(1, 'Full name is required').max(100, 'Full name must be less than 100 characters'),
    lastName: z.string().optional(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('user');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, role, signIn, signUp, loading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'assist') {
        (async () => {
          try {
            const { data, error } = await (supabase as any)
              .from('profiles')
              .select('onboarding_completed')
              .eq('id', user.id)
              .maybeSingle();

            if (error) throw error;

            const completed = (data as any)?.onboarding_completed ?? false;
            navigate(completed ? '/dashboard/assist' : '/orientation/welcome');
          } catch (err) {
            console.error('Error checking onboarding status:', err);
            navigate('/dashboard/assist');
          }
        })();
      } else {
        navigate('/dashboard/user');
      }
    }
  }, [user, role, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const schema = isLogin ? loginSchema : selectedRole === 'assist' ? signupAssistSchema : signupUserSchema;
    const result = schema.safeParse(formData);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((error) => {
        if (error.path[0]) {
          fieldErrors[error.path[0] as string] = error.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(formData.email, formData.password, selectedRole);
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: error.message,
        });
        setIsSubmitting(false);
        return;
      }
      toast({
        title: 'Welcome back!',
        description: 'Redirecting to your dashboard...',
      });
      // Navigation handled by useEffect
    } else {
      const fullName = formData.firstName.trim();
      const { error } = await signUp(
        formData.email,
        formData.password,
        fullName,
        selectedRole === 'assist' ? '' : formData.lastName,
        selectedRole
      );
      if (error) {
        const anyErr = error as any;
        const code = String(anyErr?.code ?? "").trim();
        const status = Number(anyErr?.status ?? 0);

        let message = error.message;
        if (message.includes('already registered')) {
          message = 'An account with this email already exists. Please login instead.';
        }

        // Supabase Auth sends emails on signup; repeated tests can hit rate limits (HTTP 429)
        if (status === 429 || code === 'over_email_send_rate_limit' || message.toLowerCase().includes('email rate limit exceeded')) {
          message =
            'Too many sign-up attempts in a short time (email rate limit). ' +
            'Please wait a few minutes and try again.';
        }

        toast({
          variant: 'destructive',
          title: 'Sign up failed',
          description: message,
        });
        setIsSubmitting(false);
        return;
      }

      const first = formData.firstName.trim();
      const last = selectedRole === 'assist' ? '' : formData.lastName.trim();

      if (selectedRole === 'assist') {
        sessionStorage.setItem('orientation_fullName', first);
        sessionStorage.setItem('orientation_firstName', first);
        sessionStorage.setItem('orientation_lastName', last);
      }

      if (selectedRole === 'user') {
        sessionStorage.setItem('onboarding_firstName', first);
        sessionStorage.setItem('onboarding_lastName', last);
      }

      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account.',
      });
      setIsLogin(true);
    }
    
    setIsSubmitting(false);
  };

  const handleForgotPassword = async () => {
    const email = forgotEmail.trim();
    if (!email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your email.' });
      return;
    }

    setForgotSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      toast({
        title: 'Email sent',
        description: 'Please check your inbox for the password reset link.',
      });
      setForgotOpen(false);
      setForgotEmail('');
    } catch (e: any) {
      const msg = String(e?.message ?? 'Failed to send reset email.');
      const code = String(e?.code ?? '').trim();
      const status = Number(e?.status ?? 0);

      const description =
        status === 429 || code === 'over_email_send_rate_limit' || msg.toLowerCase().includes('email rate limit exceeded')
          ? 'Too many email requests in a short time. Please wait a few minutes and try again.'
          : msg;

      toast({ variant: 'destructive', title: 'Failed', description });
    } finally {
      setForgotSubmitting(false);
    }
  };

  const { settings: layoutSettings, loading: layoutLoading, hasCache: layoutHasCache } = useWebsiteLayoutSettings();
  const showLayoutPlaceholder = layoutLoading && !layoutHasCache;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-12">
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            {showLayoutPlaceholder ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted animate-pulse" />
                <div className="h-6 w-40 rounded bg-muted animate-pulse" />
              </>
            ) : layoutSettings.header.logoUrl ? (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background overflow-hidden">
                  <img
                    src={layoutSettings.header.logoUrl}
                    alt={layoutSettings.header.logoAlt || layoutSettings.header.brandName}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="text-2xl font-bold text-foreground">{layoutSettings.header.brandName}</span>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <span className="text-xl font-bold text-primary-foreground">{layoutSettings.header.brandMarkText}</span>
                </div>
                <span className="text-2xl font-bold text-foreground">{layoutSettings.header.brandName}</span>
              </>
            )}
          </Link>
        </div>

        <Card className="shadow-soft">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Login to access your dashboard'
                : 'Sign up to get started with your marketing assist'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Role Selection */}
              <div className="space-y-3">
                <Label>Login as</Label>
                <RadioGroup
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as AppRole)}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem
                      value="user"
                      id="user"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="user"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-card p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                    >
                      <Briefcase className="mb-2 h-6 w-6 text-primary" />
                      <span className="text-sm font-medium">Business Owner</span>
                      <span className="text-xs text-muted-foreground">Client</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="assist"
                      id="assist"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="assist"
                      className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-card p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                    >
                      <UserCircle className="mb-2 h-6 w-6 text-accent" />
                      <span className="text-sm font-medium">Marketing Assist</span>
                      <span className="text-xs text-muted-foreground">Freelancer</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Name (signup only) */}
              {!isLogin && (
                selectedRole === 'assist' ? (
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Full Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John Doe"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value, lastName: '' })}
                      className={errors.firstName ? 'border-destructive' : ''}
                    />
                    {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className={errors.firstName ? 'border-destructive' : ''}
                      />
                      {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className={errors.lastName ? 'border-destructive' : ''}
                      />
                      {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                    </div>
                  </div>
                )
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}

                {isLogin && (
                  <div className="pt-1 text-right">
                    <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Forgot password?
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reset password</DialogTitle>
                          <DialogDescription>
                            Enter your email and we’ll send you a link to set a new password.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                          <Label htmlFor="forgotEmail">Email</Label>
                          <Input
                            id="forgotEmail"
                            type="email"
                            placeholder="your@email.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                          />
                        </div>

                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setForgotOpen(false)}
                            disabled={forgotSubmitting}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={forgotSubmitting}
                          >
                            {forgotSubmitting ? 'Sending...' : 'Send reset link'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>

              {/* Confirm Password (signup only) */}
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="text-sm text-center text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFormData({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
                }}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? 'Sign up' : 'Login'}
              </button>
            </div>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}