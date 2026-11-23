
def calculate_grade(marks):
    if marks >= 90:
        return 'A+'
    elif marks >= 80:
        return 'A'
    elif marks >= 60:
        return 'B'
    else:
        return 'C'

# Passing criteria is minimum 40 marks
threshold = 40
