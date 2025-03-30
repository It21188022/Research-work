import React, { useState, useEffect, useCallback, useRef } from 'react';
import MainLayout from "../../components/MainLayout";
import InstructionsQuiz from './InstructionsQuiz';
import { TbHandClick } from "react-icons/tb";
import { FaRankingStar } from "react-icons/fa6";
import { RiRobot2Fill } from "react-icons/ri";
import "../../css/quiz.css";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const QuizPage = () => {
    const navigate = useNavigate();
    const [currentStage, setCurrentStage] = useState(1);
    const [completedStage, setCompletedStage] = useState(null);
    const [currentLevel, setCurrentLevel] = useState(1);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const [feedback, setFeedback] = useState('');
    const [score, setScore] = useState(0);
    const [time, setTime] = useState(60);
    const [quizStarted, setQuizStarted] = useState(false);
    const [quizFinished, setQuizFinished] = useState(false);
    const [showExitConfirmation, setShowExitConfirmation] = useState(false);
    const [stageRequirements, setStageRequirements] = useState({});
    const [loading, setLoading] = useState(true);
    const timerRef = useRef(null);
    const [timerActive, setTimerActive] = useState(false);
    const [aiExplanation, setAiExplanation] = useState('');
    const [explanationLoading, setExplanationLoading] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [isModalOpen, setModalOpen] = useState(false);

    const loadRequirements = useCallback(async (stage) => {
        try {
            const storedData = localStorage.getItem('account');
            const { token } = JSON.parse(storedData);
            const response = await axios.get(`/api/quiz/stage-requirements?stage=${stage}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStageRequirements(prev => ({ ...prev, ...response.data }));
        } catch (error) {
            console.error('Error loading requirements:', error);
        }
    }, []);

    useEffect(() => {
        const initializeQuiz = async () => {
            const storedData = localStorage.getItem('account');
            if (!storedData) {
                navigate('/login');
                return;
            }
            try {
                const { token } = JSON.parse(storedData);
                const config = { headers: { Authorization: `Bearer ${token}` } };
    
                const progressRes = await axios.get('/api/quiz/highest-stage', config);
                const highestStage = progressRes.data.highestStage;
    
                const requirementsRes = await axios.get(`/api/quiz/stage-requirements?stage=${highestStage + 1}`, config);
    
                const initialStage = highestStage + 1;
                setCurrentStage(initialStage);
                setTime(requirementsRes.data[initialStage]?.time || 60);
                setStageRequirements(requirementsRes.data);
                setLoading(false);
    
            } catch (error) {
                console.error('Error initializing quiz:', error);
                if (error.response?.status === 401) {
                    navigate('/login');
                } else {
                    alert("An error occurred while initializing the quiz.");
                    setLoading(false);
                }
            }
        };
        initializeQuiz();
    }, [navigate, loadRequirements]);

    const handleQuizFinish = useCallback(async (stage, finalScore) => {
        setQuizFinished(true);
        setCompletedStage(stage);
        setTimerActive(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        try {
            const storedData = localStorage.getItem('account');
            const { token } = JSON.parse(storedData);
            await axios.post('/api/quiz/save-result',
                { score: finalScore, stage },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error('Result save error:', error);
        }
    }, []);

    useEffect(() => {
        if (quizStarted && timerActive && !quizFinished) {
            timerRef.current = setInterval(() => {
                setTime(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                        handleQuizFinish(currentStage, score);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [quizStarted, timerActive, quizFinished, currentStage, score, handleQuizFinish]);

    const loadQuestion = useCallback(async (level) => {
        try {
            const storedData = localStorage.getItem('account');
            const { token } = JSON.parse(storedData);
            const response = await axios.get(`/api/questions/${level}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data?.length > 0) {
                const randomQuestion = response.data[Math.floor(Math.random() * response.data.length)];
                setCurrentQuestion(randomQuestion);
            }
        } catch (error) {
            console.error('Question load error:', error);
        }
    }, []);

    const handleAnswer = async (answer) => {
        if (feedback || !currentQuestion) return;

        const correct = answer === currentQuestion.correct_answer;
        setFeedback(correct ? 'Correct!' : 'Incorrect!');
        setSelectedAnswer(answer);
        setTimerActive(false);

        if (correct) {
            setScore(prev => prev + currentLevel);
        }

        try {
            const storedData = localStorage.getItem('account');
            const { token } = JSON.parse(storedData);
            const response = await axios.post('/api/questions/next-level',
                { currentLevel, isCorrect: correct },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setCurrentLevel(response.data.nextLevel);
        } catch (error) {
            console.error('Level progression error:', error);
        }
    };

    const startNewStage = (stage) => {
        const stageTime = stageRequirements[stage]?.time || 60;
        
        localStorage.setItem('currentStage', stage);
        setCurrentStage(stage);
        setQuizStarted(true);
        setQuizFinished(false);
        setScore(0);
        setCurrentLevel(1);
        setTime(stageTime);
        setFeedback('');
        setSelectedAnswer('');
        loadQuestion(1);
        setTimerActive(true);
    };
    
    useEffect(() => {
        if (currentStage > 1 && !stageRequirements[currentStage]) {
            loadRequirements(currentStage);
        }
        const stageTime = stageRequirements[currentStage]?.time || 60;
        setTime(stageTime);
    }, [currentStage, stageRequirements, loadRequirements]);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const storedData = localStorage.getItem('account');
            if (!storedData) return;
            const { token } = JSON.parse(storedData);
            const response = await axios.get('/api/quiz/leaderboard', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeaderboard(response.data);
            setShowLeaderboard(true);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        }
    }, []);

    const handleGetExplanation = async () => {
        setExplanationLoading(true);
        setAiExplanation('');
        try {
            const storedData = localStorage.getItem('account');
            const { token } = JSON.parse(storedData);
    
            const response = await axios.post('/api/quiz/get-explanation', {
                question: currentQuestion.question,
                options: currentQuestion.options,
                correctAnswer: currentQuestion.options[
                    currentQuestion.correct_answer.charCodeAt(0) - 65
                ]
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
    
            const explanation = response.data.explanation || "Could not generate explanation";
            setAiExplanation(explanation);
    
        } catch (error) {
            console.error('Explanation error:', error);
            setAiExplanation(error.response?.data?.explanation || "Explanation service unavailable");
        }
        setExplanationLoading(false);
    };

    const handleNextQuestion = () => {
        setFeedback('');
        setSelectedAnswer('');
        setAiExplanation('');
        loadQuestion(currentLevel);
        setTimerActive(true);
    };

    //instruction button
    const handleModalOpen = () => {
        setModalOpen(true);
      };
    //instruction button
      const handleModalClose = () => {
        setModalOpen(false);
      };
    

    if (loading) {
        return <MainLayout><div className="loading-container">Loading...</div></MainLayout>;
    }

    const currentRequirements = stageRequirements[completedStage] || {};
    const nextStage = (completedStage || currentStage) + 1;
    const passed = score >= currentRequirements.requiredScore;

    return (
        <MainLayout>
            <div className="quiz-container">
            <div className="absolute top-1/2 right-20 transform -translate-y-1/2 flex flex-col gap-4" style={{ zIndex: 2 }}>
                <button
                    className="bg-gradient-to-b from-[#a3d8ff] to-[#60a5fa] text-white font-bold px-4 py-2 rounded-full transition-all duration-300 ease-in-out transform hover:scale-110 hover:shadow-lg flex items-center justify-center active:translate-y-1"
                    onClick={handleModalOpen}
                >
                    <TbHandClick className="w-6 h-6 mr-2" />
                    <span className="text-xl font-playfair-display">Instructions</span>
                </button>
                <button
                    className="bg-gradient-to-b from-[#e3fcd7] to-[#4caf50] text-white font-bold px-4 py-2 rounded-full transition-all duration-300 ease-in-out transform hover:scale-110 hover:shadow-lg flex items-center justify-center active:translate-y-1"
                    onClick={fetchLeaderboard}
                >
                    <FaRankingStar className="w-6 h-6 mr-2" />
                    <span className="text-xl font-playfair-display">Leaderboard</span>
                </button>
            </div>
                {showLeaderboard && (
                            <div className="leaderboard-modal">
                                <div className="leaderboard-content">
                                <div className="leaderboard-header">
                                    <h3>Leaderboard</h3>
                                    <button 
                                    onClick={() => setShowLeaderboard(false)} 
                                    className="close-button"
                                    >
                                    ×
                                    </button>
                                </div>
                                <table>
                                    <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>User</th>
                                        <th>Stage</th>
                                        <th>Score</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {leaderboard.map((user, index) => (
                                        <tr key={user.userName + index}>
                                        <td>{index + 1}</td>
                                        <td>{user.userName}</td>
                                        <td>{user.stage}</td>
                                        <td>{user.score}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        )}
                {quizFinished ? (
                    <div className="results-screen">
                        <h2>Stage {completedStage} Results</h2>
                        <div className="final-score">
                            Score: {score} / {currentRequirements.requiredScore}
                        </div>
                        {passed ? (
                            <button
                                onClick={() => startNewStage(nextStage)}
                                className="next-button"
                            >
                                Start Stage {nextStage}
                            </button>
                        ) : (
                            <>
                                <p className="retake-message">
                                    Required score for Stage {completedStage + 1}: {currentRequirements.requiredScore}
                                </p>
                                <button
                                    onClick={() => startNewStage(completedStage)}
                                    className="retake-button"
                                >
                                    Retry Stage {completedStage}
                                </button>
                            </>
                        )}
                    </div>
                ) : !quizStarted ? (
                    <div className="start-screen">
                        <h1>Waste Management Challenge</h1>
                        <button
                            onClick={() => startNewStage(currentStage)}
                            className="start-button"
                        >
                            Start Stage {currentStage}
                        </button>
                    </div>
                ) : (
                    <>
                        <h1>Stage {currentStage} - Time Left: {time}s</h1>
                        <div className="quiz-status">
                            <span>Difficulty: {currentLevel}</span>
                            <span>Score: {score}</span>
                            <button
                                onClick={() => setShowExitConfirmation(true)}
                                className="exit-button"
                            >
                                Exit Quiz
                            </button>
                        </div>

                        {showExitConfirmation && (
                            <div className="confirmation-modal">
                                <div className="confirmation-content">
                                    <h3>Are you sure you want to exit?</h3>
                                    <div className="confirmation-buttons">
                                        <button
                                            className="confirm-button"
                                            onClick={() => {
                                                setQuizStarted(false);
                                                setQuizFinished(false);
                                                navigate('/');
                                            }}
                                        >
                                            Yes
                                        </button>
                                        <button
                                            className="cancel-button"
                                            onClick={() => setShowExitConfirmation(false)}
                                        >
                                            No
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}


                        {currentQuestion ? (
                            <div className="question-block">
                                <div className="question-meta">
                                    <span className="subject-tag">{currentQuestion.subject}</span>
                                    <span className="level-info">Difficulty: {currentQuestion.level}</span>
                                </div>
                                <h2>{currentQuestion.question}</h2>
                                <div className="options">
                                    {currentQuestion.options.map((option, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleAnswer(String.fromCharCode(65 + index))}
                                            disabled={!!feedback}
                                            className={`option-btn ${
                                                selectedAnswer === String.fromCharCode(65 + index)
                                                    ? 'selected'
                                                    : ''
                                            }`}
                                        >
                                            {String.fromCharCode(65 + index)}. {option}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="loading-container">Loading Question...</div>
                        )}

                        {feedback && (
                            <div className={`feedback ${feedback.toLowerCase()}`}>
                                <h3 style={{ color: feedback === 'Correct!' ? '#28a745' : '#dc3545' }}>
                                    {feedback}
                                </h3>
                                
                                {feedback === 'Incorrect!' && (
                                    <div className="correct-answer">
                                        <strong>Correct Answer:</strong> {String.fromCharCode(65 + currentQuestion.correct_answer.charCodeAt(0) - 65)}. {currentQuestion.options[currentQuestion.correct_answer.charCodeAt(0) - 65]}
                                    </div>
                                )}

                                <div className="feedback-buttons">
                                    {!explanationLoading && !aiExplanation && (
                                        <button onClick={handleGetExplanation} className="ai-tutor-button">
                                            <RiRobot2Fill className="w-6 h-6 mr-2" />
                                                <span className="text-xl font-playfair-display">Ask My AI Tutor</span>
                                        </button>
                                    )}

                                    <button onClick={handleNextQuestion} className="next-button">
                                        Next Question
                                    </button>
                                </div>

                                {explanationLoading && <div className="explanation-loading">Generating explanation...</div>}
                                
                                {aiExplanation && (
                                    <div className="ai-explanation">
                                        <h4>AI Explanation:</h4>
                                        <p>{aiExplanation}</p>
                                    </div>
                                )}
                            </div> 
                        )}
                    </>
                )}
            </div>
            <InstructionsQuiz isOpen={isModalOpen} onClose={handleModalClose} />
        </MainLayout>
    );
};

export default QuizPage;