import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderLayout } from "@/components/order/OrderLayout";
import { OrderSummaryCard } from "@/components/order/OrderSummaryCard";
import { useOrder } from "@/contexts/OrderContext";

export default function Confirmation() {
  const navigate = useNavigate();
  const { reset } = useOrder();

  return (
    <OrderLayout title="Thank you" step="payment" sidebar={<OrderSummaryCard />}>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Order received</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Thank you! Your order is recorded (placeholder). Next, you can access your dashboard or start setup.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => {
                navigate("/dashboard/user");
              }}
            >
              Access Dashboard
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                reset();
                navigate("/");
              }}
            >
              Start Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </OrderLayout>
  );
}
