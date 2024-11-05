"use client"
import { useEffect, useState } from 'react';

export default function HelloWorldComponent() {
    const [message, setMessage] = useState('');
    useEffect(() => {
        fetch('https://7so1a2j0a4.execute-api.us-east-1.amazonaws.com/hello')
            .then((response) => response.json())
            .then((data) => setMessage(data))
            .catch((error) => console.error('Error fetching message:', error));
    }, []);

    return <div>{message}</div>;
}
