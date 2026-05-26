package com.hangout.hangoutbackend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRatingRepository extends JpaRepository<UserRating, Long> {
    List<UserRating> findByRatedUsername(String ratedUsername);
    Optional<UserRating> findByRaterUsernameAndRatedUsername(String rater, String rated);
    boolean existsByRaterUsernameAndRatedUsername(String rater, String rated);
}
