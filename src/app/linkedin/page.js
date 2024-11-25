/* eslint-disable react/no-unescaped-entities */
"use client"
import { useEffect } from 'react';

export default function Redirect() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.location.href = 'https://linkedin.com/in/batikanor';
        }
    }, []); // Empty dependency array to ensure this runs only once on component mount

    return (
        <div>
            <p>If you haven't been forwarded,  <a href="https://linkedin.com/in/batikanor">click here</a>.</p>
        </div>
    );
}
