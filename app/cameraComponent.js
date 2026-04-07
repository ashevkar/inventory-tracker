import React, { useState, useRef } from 'react';
import { Camera } from 'react-camera-pro';
import { Button, Box, Typography } from '@mui/material';
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";


const CameraComponent = ({ onDetection, inventoryItems }) => {
    const camera = useRef(null);
    // const [image, setImage] = useState(null);
    const [detecting, setDetecting] = useState(false);
    const [error, setError] = useState(null);

    const classifyImage = async (imageUrl) => {
        try {
            const response = await fetch('/api/camera', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inventory: inventoryItems,
                    img: imageUrl
                }),
            })
            if (!response.ok) {
                throw new Error('Failed to fetch recipe from API');
            }
            const data = await response.text();
            if (data) {
                return data;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error classifying image:', error);
            setError('Failed to classify image. Please try again.');
            return [];
        }
    };

    async function uploadImageToStorage(imageSrc) {
        if (!imageSrc) {
            throw new Error('No image data received');
        }
        const storageRef = ref(storage, `images_recognition/${Date.now()}.jpg`);
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        return { url, ref: storageRef };
    }

    async function deleteImageFromStorage(storageRef) {
        try {
            await deleteObject(storageRef);
        } catch (error) {
            console.error('Error deleting image:', error);
        }
    }

    const captureImage = async () => {
        setError(null);
        const imageSrc = camera.current.takePhoto();
        setDetecting(true);

        try {
            const { url, ref } = await uploadImageToStorage(imageSrc);

            const labels = await classifyImage(url);
            console.log("Object detected, ", labels);
            const detectedObject = labels.length > 0 ? labels : 'none';

            await deleteImageFromStorage(ref);

            if (detectedObject.toLowerCase().includes('none')) {
                setError('No food item detected. Please try again or enter the name manually.');
            } else {
                onDetection(detectedObject);
            }
        } catch (error) {
            console.error('Error detecting object:', error);
            setError('An error occurred while detecting the object');
        } finally {
            setDetecting(false);
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <Box sx={{ position: 'relative', paddingTop: '75%', overflow: 'hidden' }}>
                <Camera ref={camera} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            </Box>
            <Button
                variant="contained"
                color="primary"
                onClick={captureImage}
                disabled={detecting}
                fullWidth
                sx={{ mt: 2 }}
            >
                {detecting ? 'Detecting...' : 'Capture and Detect'}
            </Button>
            {error && (
                <Typography color="error" mt={2}>
                    {error}
                </Typography>
            )}
        </Box>
    );
};

export default CameraComponent;