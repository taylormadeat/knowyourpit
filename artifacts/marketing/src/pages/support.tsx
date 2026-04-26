import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  website: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Support() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      website: "",
    },
  });

  async function onSubmit(data: FormValues) {
    setStatus("loading");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error("Failed to send message");
      
      setStatus("success");
      form.reset();
    } catch (error) {
      setStatus("error");
    }
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Support</h1>
        <p className="text-xl text-muted-foreground">We're a small team. Real humans answer every email — usually within 1-2 business days.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-16">
        <div>
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How do I start a cook session?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                From the Home screen, tap <strong>Plan a Cook</strong>. Choose your meat type and weight, set your target internal temperature, and the app will calculate an estimated cook time. Tap <strong>Start Cook</strong> to begin the live session.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How do I connect my MEATER probe?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Go to <strong>Settings → Thermometer Devices</strong> and tap <strong>Add MEATER</strong>. Enter your MEATER account email and password. Once linked, your probe readings will appear automatically on the Cook screen during an active session.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Why isn't my probe temperature showing up?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Check that your thermometer is powered on and within Bluetooth range of the MEATER Block or Link. Also confirm your MEATER credentials are saved correctly in Settings. If the problem persists, remove the device connection and re-add it.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>How do temperature alerts work?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                You can set a target temperature alert on the Cook screen. When your probe hits that temperature, the app sends a local notification — even when the app is in the background. Make sure notifications are enabled for knowyourpit in your iPhone Settings.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>How do I delete my account or my data?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Email us at <a href="mailto:support@knowyourpit.com" className="text-primary hover:underline">support@knowyourpit.com</a> with the subject line "Delete my account" and we will permanently remove your account and all associated data within 7 days.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger>The AI cook time prediction seems off — what should I do?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                AI predictions improve as you log more cooks with ratings. After each session, rate your results (tenderness, flavor, bark) so the app can refine its estimates for your grill and cook style. If predictions are consistently off, check that your grill profile (type, size, fuel) is set up accurately in Settings.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-7">
              <AccordionTrigger>Is my data private?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. Your cook sessions and temperature readings are only visible to you. We never sell personal information. See our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for full details.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">Send us a message</h2>
          <div className="bg-card border border-white/10 p-6 rounded-xl">
            {status === "success" && (
              <Alert className="mb-6 bg-green-500/10 text-green-500 border-green-500/20">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Thanks — we'll be in touch within 1–2 business days.
                </AlertDescription>
              </Alert>
            )}
            
            {status === "error" && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to send message. Please try again or email us directly.
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="hidden" aria-hidden="true">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Leave this empty" tabIndex={-1} {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="How can we help?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us what's going on..." 
                          className="min-h-[150px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full font-bold" 
                  disabled={status === "loading" || status === "success"}
                >
                  {status === "loading" ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
