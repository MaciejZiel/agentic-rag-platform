import { useState } from "react";
import { CreditCard, Check, Zap, Building2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    description: "For personal projects and experimentation.",
    features: [
      "5 documents",
      "50 queries / month",
      "GPT-4o Mini only",
      "512 token chunks",
      "Community support",
    ],
    limits: {
      documents: 5,
      queries: 50,
      models: 1,
    },
    current: true,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    icon: Rocket,
    description: "For professionals and small teams.",
    popular: true,
    features: [
      "100 documents",
      "2,000 queries / month",
      "All models (GPT-4o, Claude, Gemini)",
      "Configurable chunking strategies",
      "Conversation history",
      "Webhook notifications",
      "Priority support",
    ],
    limits: {
      documents: 100,
      queries: 2000,
      models: 8,
    },
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/ month",
    icon: Building2,
    description: "For organizations with advanced needs.",
    features: [
      "Unlimited documents",
      "Unlimited queries",
      "All models + custom models",
      "Multi-tenant isolation",
      "API key management",
      "Prometheus monitoring",
      "Custom webhooks with HMAC",
      "SSO & audit logs",
      "Dedicated support",
    ],
    limits: {
      documents: -1,
      queries: -1,
      models: -1,
    },
  },
];

export function SubscriptionsPage() {
  const [selectedPlan, setSelectedPlan] = useState("Free");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight flex items-center justify-center gap-2">
          <CreditCard className="h-6 w-6" /> Choose Your Plan
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Scale your document intelligence platform with the right plan for your
          needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.name;

          return (
            <Card
              key={plan.name}
              className={`relative flex flex-col transition-all ${
                plan.popular ? "border-primary shadow-md" : ""
              } ${isSelected ? "ring-2 ring-primary" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="text-[10px]">Most Popular</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="mx-auto rounded-lg bg-muted p-2.5 w-fit">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {plan.description}
                </p>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <div className="text-center mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">
                    {plan.period}
                  </span>
                </div>

                <Separator className="mb-4" />

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full mt-6"
                  variant={plan.current ? "outline" : plan.popular ? "default" : "outline"}
                  onClick={() => setSelectedPlan(plan.name)}
                  disabled={plan.current}
                >
                  {plan.current
                    ? "Current Plan"
                    : isSelected
                    ? "Selected"
                    : `Upgrade to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Can I switch plans anytime?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Yes. Upgrades take effect immediately. Downgrades apply at the end
              of your billing cycle.
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">
              What happens when I hit my limit?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll be notified and can upgrade. Existing documents and
              conversations are preserved.
            </p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">Do you offer annual billing?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Annual billing with 20% discount is coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
