/* eslint-disable react/no-unescaped-entities */
// src/app/cv/en/page.js
"use client"
import { useEffect } from 'react';
import { CV_CONFIG } from '../config';

export default function CvRedirect() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.location.href = CV_CONFIG.pdfDownloadUrl;
        }
    }, []); // Empty dependency array to ensure this runs only once on component mount

    return (
        <div>
            <p>Downloading batikan's most up-to-date CV...</p>
            <p>If the download hasn't started, <a href={CV_CONFIG.pdfDownloadUrl}>click here</a>.</p>
        </div>
    );
}
