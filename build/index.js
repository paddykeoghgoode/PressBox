/**
 * PitchPerfect - Football Writing Assistant
 * Pre-built version for WordPress
 */
(function() {
    'use strict';

    const { registerPlugin } = wp.plugins;
    const { PluginSidebar, PluginSidebarMoreMenuItem } = wp.editPost;
    const { PanelBody, Button, SelectControl, Notice } = wp.components;
    const { useSelect, dispatch } = wp.data;
    const { useState, useCallback, Fragment, createElement: el } = wp.element;
    const { __ } = wp.i18n;
    const apiFetch = wp.apiFetch;

    // Severity colors
    const SEVERITY_COLORS = {
        error: '#dc3232',
        warning: '#f0b849',
        info: '#00a0d2',
    };

    // Type labels
    const TYPE_LABELS = {
        grammar: 'Grammar',
        spelling: 'Spelling',
        clarity: 'Clarity',
        style: 'Style',
        headline: 'Headline',
        terminology: 'Terminology',
        consistency: 'Consistency',
        speculation: 'Speculation',
        repetition: 'Repetition',
    };

    // Type icons
    const TYPE_ICONS = {
        grammar: 'editor-spellcheck',
        spelling: 'editor-spellcheck',
        clarity: 'visibility',
        style: 'art',
        headline: 'heading',
        terminology: 'translation',
        consistency: 'update',
        speculation: 'warning',
        repetition: 'controls-repeat',
    };

    /**
     * Main Sidebar Component
     */
    const PitchPerfectSidebar = function() {
        const [suggestions, setSuggestions] = useState([]);
        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const [lastAnalyzed, setLastAnalyzed] = useState(null);
        const [filterType, setFilterType] = useState('all');
        const [filterSeverity, setFilterSeverity] = useState('all');
        const [dismissedIds, setDismissedIds] = useState([]);
        const [expandedId, setExpandedId] = useState(null);
        const [error, setError] = useState(null);

        // Get post content
        const postData = useSelect(function(select) {
            const editor = select('core/editor');
            return {
                postContent: editor.getEditedPostContent(),
                postId: editor.getCurrentPostId(),
                postTitle: editor.getEditedPostAttribute('title'),
            };
        }, []);

        /**
         * Analyse content
         */
        const analyseContent = useCallback(function() {
            if (!postData.postContent && !postData.postTitle) {
                setSuggestions([]);
                return;
            }

            setIsAnalyzing(true);
            setError(null);

            var fullContent = '<h1>' + (postData.postTitle || '') + '</h1>\n' + postData.postContent;

            apiFetch({
                path: '/pitchperfect/v1/analyse',
                method: 'POST',
                data: {
                    postId: postData.postId,
                    content: fullContent,
                    language: 'en-GB',
                    context: 'football_article',
                },
            }).then(function(response) {
                setSuggestions(response.suggestions || []);
                setLastAnalyzed(new Date());
                setDismissedIds([]);
                setIsAnalyzing(false);
            }).catch(function(err) {
                console.error('PitchPerfect error:', err);
                setError(err.message || 'Analysis failed');
                setIsAnalyzing(false);
            });
        }, [postData]);

        /**
         * Check if ID is dismissed
         */
        var isDismissed = function(id) {
            return dismissedIds.indexOf(id) !== -1;
        };

        /**
         * Filter suggestions
         */
        var filteredSuggestions = suggestions.filter(function(s) {
            if (isDismissed(s.id)) return false;
            if (filterType !== 'all' && s.type !== filterType) return false;
            if (filterSeverity !== 'all' && s.severity !== filterSeverity) return false;
            return true;
        });

        /**
         * Get counts
         */
        var getCounts = function() {
            var counts = { total: 0, error: 0, warning: 0, info: 0 };
            suggestions.forEach(function(s) {
                if (!isDismissed(s.id)) {
                    counts.total++;
                    counts[s.severity]++;
                }
            });
            return counts;
        };

        var suggestionCounts = getCounts();

        /**
         * Dismiss suggestion
         */
        var dismissSuggestion = function(id) {
            setDismissedIds(dismissedIds.concat([id]));
        };

        /**
         * Apply replacement
         */
        var applyReplacement = function(suggestion) {
            dismissSuggestion(suggestion.id);
            dispatch('core/notices').createNotice(
                'info',
                __('Suggestion noted. Please apply the change manually in your content.', 'pitchperfect'),
                { type: 'snackbar', isDismissible: true }
            );
        };

        /**
         * Render suggestion card
         */
        var renderSuggestion = function(suggestion) {
            var isExpanded = expandedId === suggestion.id;
            var severityColor = SEVERITY_COLORS[suggestion.severity] || SEVERITY_COLORS.info;
            var typeLabel = TYPE_LABELS[suggestion.type] || suggestion.type;
            var typeIcon = TYPE_ICONS[suggestion.type] || 'editor-help';

            var children = [
                // Header
                el('div', {
                    key: 'header',
                    style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                    },
                },
                    el('div', {
                        style: { display: 'flex', alignItems: 'center', gap: '6px' },
                    },
                        el('span', {
                            className: 'dashicons dashicons-' + typeIcon,
                            style: { fontSize: '16px', color: severityColor },
                        }),
                        el('span', {
                            style: {
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                color: severityColor,
                            },
                        }, typeLabel)
                    ),
                    el(Button, {
                        isSmall: true,
                        icon: isExpanded ? 'arrow-up-alt2' : 'arrow-down-alt2',
                        onClick: function() { setExpandedId(isExpanded ? null : suggestion.id); },
                        label: isExpanded ? 'Collapse' : 'Expand',
                    })
                ),
                // Message
                el('p', {
                    key: 'message',
                    style: { margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5' },
                }, suggestion.message),
            ];

            // Expanded content
            if (isExpanded) {
                if (suggestion.explanation) {
                    children.push(el('p', {
                        key: 'explanation',
                        style: {
                            margin: '8px 0',
                            padding: '8px',
                            backgroundColor: '#f6f7f7',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#50575e',
                            fontStyle: 'italic',
                        },
                    }, suggestion.explanation));
                }

                if (suggestion.replacements && suggestion.replacements.length > 0) {
                    var repButtons = suggestion.replacements.map(function(rep, idx) {
                        return el(Button, {
                            key: idx,
                            isSecondary: true,
                            isSmall: true,
                            onClick: function() { applyReplacement(suggestion); },
                            style: { marginRight: '4px', marginBottom: '4px' },
                        }, rep);
                    });

                    children.push(el('div', {
                        key: 'replacements',
                        style: { marginTop: '8px' },
                    },
                        el('span', {
                            style: { fontSize: '11px', color: '#757575', display: 'block', marginBottom: '4px' },
                        }, 'Suggested:'),
                        repButtons
                    ));
                }
            }

            // Actions
            children.push(el('div', {
                key: 'actions',
                style: {
                    display: 'flex',
                    gap: '8px',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e0e0e0',
                },
            },
                el(Button, {
                    isSmall: true,
                    isDestructive: true,
                    onClick: function() { dismissSuggestion(suggestion.id); },
                }, __('Dismiss', 'pitchperfect'))
            ));

            return el('div', {
                key: suggestion.id,
                style: {
                    borderLeft: '4px solid ' + severityColor,
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                },
            }, children);
        };

        /**
         * Render stats
         */
        var renderStats = function() {
            return el('div', {
                style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    marginBottom: '12px',
                },
            },
                el('div', {
                    style: { textAlign: 'center', padding: '8px', backgroundColor: '#fef7f1', borderRadius: '4px' },
                },
                    el('div', { style: { fontSize: '20px', fontWeight: 'bold', color: SEVERITY_COLORS.error } }, suggestionCounts.error),
                    el('div', { style: { fontSize: '10px', color: '#757575' } }, 'Errors')
                ),
                el('div', {
                    style: { textAlign: 'center', padding: '8px', backgroundColor: '#fef8e7', borderRadius: '4px' },
                },
                    el('div', { style: { fontSize: '20px', fontWeight: 'bold', color: SEVERITY_COLORS.warning } }, suggestionCounts.warning),
                    el('div', { style: { fontSize: '10px', color: '#757575' } }, 'Warnings')
                ),
                el('div', {
                    style: { textAlign: 'center', padding: '8px', backgroundColor: '#e5f5fa', borderRadius: '4px' },
                },
                    el('div', { style: { fontSize: '20px', fontWeight: 'bold', color: SEVERITY_COLORS.info } }, suggestionCounts.info),
                    el('div', { style: { fontSize: '10px', color: '#757575' } }, 'Info')
                )
            );
        };

        /**
         * Build type filter options
         */
        var typeOptions = [{ label: 'All Types', value: 'all' }];
        Object.keys(TYPE_LABELS).forEach(function(key) {
            var count = suggestions.filter(function(s) { return s.type === key && !isDismissed(s.id); }).length;
            typeOptions.push({
                label: TYPE_LABELS[key] + ' (' + count + ')',
                value: key,
            });
        });

        /**
         * Main render
         */
        return el(Fragment, null,
            el(PluginSidebarMoreMenuItem, {
                target: 'pitchperfect-sidebar',
                icon: 'editor-spellcheck',
            }, __('PitchPerfect', 'pitchperfect')),

            el(PluginSidebar, {
                name: 'pitchperfect-sidebar',
                title: __('PitchPerfect', 'pitchperfect'),
                icon: 'editor-spellcheck',
            },
                // Analysis Controls
                el(PanelBody, {
                    title: __('Analysis', 'pitchperfect'),
                    initialOpen: true,
                },
                    el(Button, {
                        isPrimary: true,
                        isBusy: isAnalyzing,
                        disabled: isAnalyzing,
                        onClick: analyseContent,
                        style: { width: '100%', justifyContent: 'center', marginBottom: '12px' },
                    }, isAnalyzing ? __('Analysing...', 'pitchperfect') : __('Analyse Content', 'pitchperfect')),

                    lastAnalyzed && el('p', {
                        style: { fontSize: '11px', color: '#757575', margin: '0' },
                    }, __('Last analysed: ', 'pitchperfect') + lastAnalyzed.toLocaleTimeString()),

                    error && el(Notice, {
                        status: 'error',
                        isDismissible: true,
                        onRemove: function() { setError(null); },
                    }, error)
                ),

                // Summary
                suggestions.length > 0 && el(PanelBody, {
                    title: __('Summary', 'pitchperfect'),
                    initialOpen: true,
                }, renderStats()),

                // Filters
                suggestions.length > 0 && el(PanelBody, {
                    title: __('Filters', 'pitchperfect'),
                    initialOpen: false,
                },
                    el(SelectControl, {
                        label: __('Type', 'pitchperfect'),
                        value: filterType,
                        options: typeOptions,
                        onChange: setFilterType,
                    }),
                    el(SelectControl, {
                        label: __('Severity', 'pitchperfect'),
                        value: filterSeverity,
                        options: [
                            { label: 'All Severities', value: 'all' },
                            { label: 'Errors', value: 'error' },
                            { label: 'Warnings', value: 'warning' },
                            { label: 'Info', value: 'info' },
                        ],
                        onChange: setFilterSeverity,
                    })
                ),

                // Suggestions
                el(PanelBody, {
                    title: __('Suggestions', 'pitchperfect') + ' (' + filteredSuggestions.length + ')',
                    initialOpen: true,
                },
                    filteredSuggestions.length === 0 && suggestions.length === 0 && el('p', {
                        style: { color: '#757575', fontStyle: 'italic' },
                    }, __('Click "Analyse Content" to check your article.', 'pitchperfect')),

                    filteredSuggestions.length === 0 && suggestions.length > 0 && el('p', {
                        style: { color: '#757575', fontStyle: 'italic' },
                    }, __('No suggestions match your filters.', 'pitchperfect')),

                    filteredSuggestions.map(renderSuggestion)
                ),

                // About
                el(PanelBody, {
                    title: __('About PitchPerfect', 'pitchperfect'),
                    initialOpen: false,
                },
                    el('p', {
                        style: { fontSize: '12px', color: '#757575' },
                    }, __('PitchPerfect helps football journalists write better articles with UK English conventions and football-specific style guidance.', 'pitchperfect')),
                    el('p', {
                        style: { fontSize: '11px', color: '#999' },
                    }, 'Version 1.0.0')
                )
            )
        );
    };

    // Register plugin
    registerPlugin('pitchperfect', {
        render: PitchPerfectSidebar,
        icon: 'editor-spellcheck',
    });

})();
