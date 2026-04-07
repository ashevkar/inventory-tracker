import React, { useState } from 'react';
import {
    Box,
    DialogActions,
    Button,
    Typography,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Alert,
} from '@mui/material';


const RecipeSuggestion = ({ onClose, inventoryItems }) => {
    const [recipe, setRecipe] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const aiRecipeGenerator = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/recipe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inventory: inventoryItems
                }),
            })
            if (!response.ok) {
                throw new Error('Failed to fetch recipe from API');
            }
            const data = await response.text();
            return data || null;
        } catch (error) {
            console.error('Error getting recipe from AI: ', error);
            setError('Failed to get recipe. Please try again.');
            return null;
        }
    };

    const getRecipeSuggestion = async () => {
        setLoading(true);
        setError(null);
        try {
            const recipeText = await aiRecipeGenerator();
            if (!recipeText) {
                throw new Error('API error!');
            } else {
                const recipeParts = recipeText.split('\n\n').filter(Boolean);
                const nameSection = recipeParts.find((part) => part.toLowerCase().includes('recipe name')) || recipeParts[0] || '';
                const ingredientsSection = recipeParts.find((part) => part.toLowerCase().includes('ingredients')) || '';
                const instructionsSection = recipeParts.find((part) => part.toLowerCase().includes('instructions')) || recipeParts[2] || '';
                const recipe = {
                    name: nameSection.replace(/recipe name:\s*/i, '').trim() || 'Suggested Recipe',
                    ingredients: ingredientsSection
                        .replace(/ingredients:\s*/i, '')
                        .split('\n')
                        .map((line) => line.replace(/^[-*]\s*/, '').trim())
                        .filter(Boolean),
                    steps: instructionsSection
                        .replace(/instructions:\s*/i, '')
                        .split('\n')
                        .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
                        .filter(Boolean),
                };
                setRecipe(recipe);
            }
        } catch (error) {
            console.error('Error generating recipe: ', error);
            setError('An error occurred while generating/extracting the recipe.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box maxWidth="md" width="100%">
            <Box display="flex" flexDirection="column" alignItems="left" padding={2}>
                <Typography variant="h6" gutterBottom>
                    Available Ingredients:
                </Typography>
                <Typography
                    variant="overline"
                    color="textSecondary"
                    sx={{ marginLeft: 2, display: 'inline', fontSize: '0.875rem' }}
                >
                    {inventoryItems.join(', ')}
                </Typography>
            </Box>
            {loading ? (
                <CircularProgress />
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : recipe ? (
                <>
                    <Typography variant="h6" gutterBottom>
                        Suggested Recipe: {recipe.name}
                    </Typography>
                    <Typography variant="subtitle1" gutterBottom>
                        Ingredients:
                    </Typography>
                    <List dense>
                        {recipe.ingredients.map((ingredient, index) => (
                            <ListItem key={index}>
                                <ListItemText primary={ingredient} />
                            </ListItem>
                        ))}
                    </List>
                    <Typography variant="subtitle1" gutterBottom>
                        Steps:
                    </Typography>
                    <List dense>
                        {recipe.steps.map((step, index) => (
                            <ListItem key={index}>
                                <ListItemText primary={`${step}`} />
                            </ListItem>
                        ))}
                    </List>
                </>
            ) : (
                <Typography padding={2}>Click &apos;Get Recipe Suggestion&apos; to generate a recipe.</Typography>
            )}
            <DialogActions>
                <Button onClick={getRecipeSuggestion} color="primary" disabled={loading}>
                    Get Recipe Suggestion
                </Button>
                <Button onClick={onClose} color="primary">
                    Close
                </Button>
            </DialogActions>
        </Box>
    );
};

export default RecipeSuggestion;