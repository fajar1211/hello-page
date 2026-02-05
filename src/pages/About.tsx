import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Users, Globe, DollarSign, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PageHero } from '@/components/layout/PageHero';
import heroAbout from '@/assets/hero-about.jpg';
import { usePageSeo } from '@/hooks/usePageSeo';

const values = [
  {
    icon: Heart,
    title: 'Personal, Direct Support',
    description: 'You work directly with your marketing assist, not a rotating team of strangers.',
  },
  {
    icon: Users,
    title: 'Freelancer-Based Service',
    description: 'We\'re not a big agency. We\'re skilled marketers who care about your success.',
  },
  {
    icon: Globe,
    title: 'Available Worldwide',
    description: 'We work with clients across the globe, adapting to your timezone and needs.',
  },
  {
    icon: DollarSign,
    title: 'Affordable Pricing',
    description: 'No agency overhead means better rates for you, without sacrificing quality.',
  },
];

const benefits = [
  'No long-term contracts or commitments',
  'Real humans, not bots or AI-only responses',
  'Flexible task prioritization',
  'Quick turnaround times',
  'Transparent communication',
  'Results-focused approach',
];

export default function About() {
  usePageSeo("about", {
    title: "About Us | EasyMarketingAssist",
    description: "Marketing made personal — work directly with a dedicated marketing assist.",
  });

  return (
    <PublicLayout>
      {/* Hero */}
      <PageHero
        backgroundImage={heroAbout}
        title={
          <>
            Marketing Made <span className="text-primary">Personal</span>
          </>
        }
        subtitle={"We believe great marketing shouldn't require big budgets or complex agency relationships."}
      />

      {/* Story */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid gap-12 md:grid-cols-2 items-center">
            <div className="animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Our Story
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  EasyMarketingAssist was born from a simple observation: small business owners 
                  don't need a full agency. They need a dedicated person who understands their 
                  business and can handle marketing tasks efficiently.
                </p>
                <p>
                  We started as freelancers helping local businesses with their digital marketing. 
                  Over time, we realized there was a better way to work — one that's more personal, 
                  more affordable, and more effective.
                </p>
                <p>
                  Today, we connect business owners with skilled marketing assists who provide 
                  the same quality of work you'd get from an agency, but with personal attention 
                  and without the overhead costs.
                </p>
              </div>
            </div>
            <div className="relative animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="aspect-square rounded-2xl overflow-hidden shadow-soft">
                <img
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=600&fit=crop"
                  alt="Team collaboration"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-primary text-primary-foreground p-6 rounded-xl shadow-lg">
                <p className="text-3xl font-bold">100+</p>
                <p className="text-sm text-primary-foreground/80">Happy Clients</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 md:py-28 bg-muted/50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              What Makes Us Different
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              We're not your typical marketing service. Here's why clients love working with us.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => (
              <Card
                key={value.title}
                className="border-0 shadow-soft bg-card text-center animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="pt-8 pb-8">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-6">
                    <value.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid gap-12 md:grid-cols-2 items-center">
            <div className="animate-fade-in">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Why Work With Us?
              </h2>
              <ul className="space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-accent flex-shrink-0" />
                    <span className="text-lg text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button size="lg" asChild>
                  <Link to="/packages">
                    View Our Packages
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="relative animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-soft">
                <img
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&h=450&fit=crop"
                  alt="Working together"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-primary">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
              Ready to Work Together?
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80">
              Let's chat about how we can help grow your business.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/contact">
                  Contact Us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/packages">View Packages</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}