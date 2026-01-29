import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type PaymentConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountUsdFormatted: string;
  disabled: boolean;
  confirming: boolean;
  onConfirm: () => void | Promise<void>;
};

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  amountUsdFormatted,
  disabled,
  confirming,
  onConfirm,
}: PaymentConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="lg" disabled={disabled}>
          Pay with Card
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm payment</AlertDialogTitle>
          <AlertDialogDescription>
            Amount: <span className="font-medium text-foreground">{amountUsdFormatted}</span>
            <br />
            During 3DS verification, Midtrans may display the amount in IDR.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={confirming || disabled}
          >
            {confirming ? "Processing..." : "Confirm & Pay"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
