-- Create table for tracking attendance (clock in / clock out)
CREATE TABLE public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own attendance records
CREATE POLICY "Users can view own attendance" ON public.attendance
    FOR SELECT USING (auth.uid() = profile_id);

-- Allow users to insert their own attendance
CREATE POLICY "Users can insert own attendance" ON public.attendance
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Allow users to update their own attendance
CREATE POLICY "Users can update own attendance" ON public.attendance
    FOR UPDATE USING (auth.uid() = profile_id);
