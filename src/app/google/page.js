// src/app/google/page.js
export default function GoogleRedirect() {
    if (typeof window !== 'undefined') {
        window.location.href = 'https://www.google.com';
    }

    return (
        <div>
            <p>Redirecting to Google...</p>
            <p>If you are not redirected, <a href="https://www.google.com">click here</a>.</p>
        </div>
    );
}
