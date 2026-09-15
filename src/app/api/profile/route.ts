import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MasterProfileData } from "@/lib/types";

export async function GET() {
  try {
    let profile = await prisma.masterProfile.findFirst();

    if (!profile) {
      profile = await prisma.masterProfile.create({
        data: {
          id: "default",
          fullName: "",
          email: "",
          phone: "",
          location: "Göteborg",
          title: "",
          summary: "",
          website: "",
          linkedin: "",
          github: "",
          experiences: "[]",
          education: "[]",
          skills: "[]",
          languages: "[]",
          projects: "[]",
          rawText: "",
        },
      });
    }

    const parsed: MasterProfileData = {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      title: profile.title,
      summary: profile.summary,
      website: profile.website,
      linkedin: profile.linkedin,
      github: profile.github,
      experiences: JSON.parse(profile.experiences || "[]"),
      education: JSON.parse(profile.education || "[]"),
      skills: JSON.parse(profile.skills || "[]"),
      languages: JSON.parse(profile.languages || "[]"),
      projects: JSON.parse(profile.projects || "[]"),
      rawText: profile.rawText,
      photoUrl: profile.photoUrl || "/profile/cv_rum_gron_vaxt.jpg",
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json(
      { error: "Kunde inte hämta profil" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const data: Partial<MasterProfileData> = await req.json();

    const updated = await prisma.masterProfile.upsert({
      where: { id: "default" },
      update: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.summary !== undefined && { summary: data.summary }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.linkedin !== undefined && { linkedin: data.linkedin }),
        ...(data.github !== undefined && { github: data.github }),
        ...(data.experiences !== undefined && {
          experiences: JSON.stringify(data.experiences),
        }),
        ...(data.education !== undefined && {
          education: JSON.stringify(data.education),
        }),
        ...(data.skills !== undefined && {
          skills: JSON.stringify(data.skills),
        }),
        ...(data.languages !== undefined && {
          languages: JSON.stringify(data.languages),
        }),
        ...(data.projects !== undefined && {
          projects: JSON.stringify(data.projects),
        }),
        ...(data.rawText !== undefined && { rawText: data.rawText }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
      },
      create: {
        id: "default",
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        location: data.location || "Göteborg",
        title: data.title || "",
        summary: data.summary || "",
        website: data.website || "",
        linkedin: data.linkedin || "",
        github: data.github || "",
        photoUrl: data.photoUrl || "/profile/cv_rum_gron_vaxt.jpg",
        experiences: JSON.stringify(data.experiences || []),
        education: JSON.stringify(data.education || []),
        skills: JSON.stringify(data.skills || []),
        languages: JSON.stringify(data.languages || []),
        projects: JSON.stringify(data.projects || []),
        rawText: data.rawText || "",
      },
    });

    return NextResponse.json({
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      phone: updated.phone,
      location: updated.location,
      title: updated.title,
      summary: updated.summary,
      website: updated.website,
      linkedin: updated.linkedin,
      github: updated.github,
      photoUrl: updated.photoUrl || "/profile/cv_rum_gron_vaxt.jpg",
      experiences: JSON.parse(updated.experiences || "[]"),
      education: JSON.parse(updated.education || "[]"),
      skills: JSON.parse(updated.skills || "[]"),
      languages: JSON.parse(updated.languages || "[]"),
      projects: JSON.parse(updated.projects || "[]"),
      rawText: updated.rawText,
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json(
      { error: "Kunde inte spara profilen" },
      { status: 500 }
    );
  }
}
