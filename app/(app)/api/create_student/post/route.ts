import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from '@/lib/auth';
import clientPromise from '@/app/lib/mongodb'; //Student database tracking
import bcrypt from 'bcryptjs'; //Security for password hashing

interface Data {
    message?: string;
}

//Accepts a request and sends out a NextResponse for Next to interpret
export async function POST(
    req: NextRequest,
    context: { params: Promise<Record<string, string>> }
): Promise<NextResponse> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    //Extracts user sign-in data
    const body = await req.json();
    const { firstname, lastname, age, grade, email, schoolname, password, gRecaptchaToken } = body;

    //Verifies all fields are filled
    if (!firstname || !lastname || !email || !password || !age || !grade || !schoolname) {
        return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    //Function to actually create and store a student
    try {
        const client = await clientPromise;
        const db = client.db('schoolcentral');
        const user_collection = db.collection('users');
        const schools_collection = db.collection('schools');

        // Check if user already exists
        const existingUser = await user_collection.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ message: 'User already exists' }, { status: 409 });
        }

        //Protect password feature
        const hashedPassword = await bcrypt.hash(password, 10);

        //School checking features
        const school_abbr = schoolname.split(':')[0].toLowerCase();
        console.log('school_abbr', school_abbr);
        const schoolnameExists = await schools_collection.findOne({ school_abbr });
        if (!schoolnameExists) {
            return NextResponse.json({ message: 'School does not exist' }, { status: 404 });
        }

        // Insert new student
        await user_collection.insertOne({
            firstname,
            lastname,
            age: Number(age),
            grade: Number(grade),
            email,
            schoolname,
            school_abbr,
            password: hashedPassword, // Store hashed password
            role: 'student',
            emailIsVerified: false,
        });

        // Results of storing students
        return NextResponse.json({ message: 'Student created successfully' }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}