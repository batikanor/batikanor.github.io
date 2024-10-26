/* eslint-disable react/no-unescaped-entities */
// src/app/cv/en/page.js
"use client"
import { useEffect } from 'react';

export default function CvRedirect() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.location.href = 'https://docs.google.com/document/d/1ZVQcdNvOR46HBUCtVy6XKFOXocRYL9-TR_LLrRfJ2T8/export?format=pdf';
        }
    }, []); // Empty dependency array to ensure this runs only once on component mount

    return (
        <div>
            <p>Downloading batikan's most up-to-date CV...</p>
            <p>If the download hasn't started, <a href="https://docs.google.com/document/d/1ZVQcdNvOR46HBUCtVy6XKFOXocRYL9-TR_LLrRfJ2T8/export?format=pdf">click here</a>.</p>
        </div>
    );
}
