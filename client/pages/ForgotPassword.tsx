import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const { sendPasswordReset } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            setError("Please enter your email address");
            return;
        }

        try {
            setError("");
            setLoading(true);
            await sendPasswordReset(email);
            setSuccess(true);
        } catch (err: any) {
            console.error('Password reset error:', err);

            if (err.code === 'auth/user-not-found') {
                setError('No account found with this email address');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address');
            } else {
                setError('Failed to send password reset email. Please try again');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-full max-w-md p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Reset Password</CardTitle>
                        <CardDescription>
                            Enter your email address and we'll send you a link to reset your password
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="space-y-4">
                                <Alert className="border-green-200 bg-green-50">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <AlertDescription className="text-green-800">
                                        Password reset email sent! Check your inbox for instructions.
                                    </AlertDescription>
                                </Alert>
                                <Link to="/login">
                                    <Button variant="outline" className="w-full">
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Back to Login
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <form className="grid gap-4" onSubmit={handleSubmit}>
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        disabled={loading}
                                        required
                                    />
                                </div>

                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading ? "Sending..." : "Send Reset Link"}
                                </Button>

                                <div className="text-center text-sm text-muted-foreground">
                                    Remember your password?{" "}
                                    <Link to="/login" className="text-primary hover:underline">
                                        Sign in
                                    </Link>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
